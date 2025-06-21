# main.py
# 必要なライブラリをインストールします: pip install fastapi "uvicorn[standard]" pydantic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
# from collections import Counter

# mahjongライブラリのインポート
from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig, OptionalRules
from mahjong.meld import Meld
from mahjong.tile import TilesConverter
from mahjong.hand_calculating.hand_response import HandResponse
# from mahjong.utils import is_agari

app = FastAPI()

# CORSの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 必要に応じてフロントエンドのURLを指定
    allow_credentials=True,
    allow_methods=["*"],  # すべてのHTTPメソッドを許可
    allow_headers=["*"],  # すべてのヘッダーを許可
)

# --- データ構造の定義 ---
class Tile(BaseModel):
    type: str
    value: int
    isRed: Optional[bool] = Field(False, alias='isRed')

class Furo(BaseModel):
    type: str
    tiles: List[Tile]

# NEW: is_tsumo と riichi_state を追加
class HandData(BaseModel):
    hand: List[Tile]
    furo: List[Furo]
    win_tile: Tile
    is_tsumo: bool
    riichi_state: int # 0: なし, 1: リーチ, 2: ダブルリーチ

class CalculationResult(BaseModel):
    yaku_list: List[str]
    han: int
    fu: int
    score: str
    error: Optional[str] = None

# --- データ変換ヘルパー (変更なし) ---
def convert_to_library_format(tiles: List[Tile]) -> List[int]:
    for t in tiles:
        print(f"Tile: type={t.type}, value={t.value}, is_red={t.isRed}, isRed={getattr(t, 'isRed', 'n/a')}")
    """フロントエンドのTileリストをmahjongライブラリの整数リストに変換"""
    tile_strings = [f"{'0' if t.isRed else t.value}{t.type}" for t in tiles]
    print("tile_strings:", tile_strings)
    return TilesConverter.string_to_136_array(tile_strings)

def convert_furo_to_library_format(furo_list: List[Furo]) -> List[Meld]:
    """フロントエンドのFuroリストをmahjongライブラリのMeldリストに変換"""
    melds = []
    for f in furo_list:
        meld_tiles_136 = convert_to_library_format(f.tiles)
        meld_type = {'pon': Meld.PON, 'chi': Meld.CHI, 'kan': Meld.KAN}.get(f.type)
        # ここでは明槓(open kan)と仮定
        is_open = f.type != 'ankan'
        melds.append(Meld(meld_type, tiles=meld_tiles_136, opened=is_open))
    return melds

# --- FastAPI アプリケーション ---
calculator = HandCalculator()

@app.post("/calculate", response_model=CalculationResult)
async def calculate_score(data: HandData):
    """手牌と状況設定を受け取り、点数計算の結果を返す"""
    try:
        hand_136 = convert_to_library_format(data.hand)
        melds = convert_furo_to_library_format(data.furo)
        win_tile_136 = convert_to_library_format([data.win_tile])[0]
        
        # 3. 点数計算の設定をフロントエンドからのデータで更新
        config = HandConfig(
            is_tsumo=data.is_tsumo,
            is_riichi=(data.riichi_state == 1),
            is_daburu_riichi=(data.riichi_state == 2),
            player_wind=HandConfig.EAST, # 親と仮定 (今後の改善点)
            round_wind=HandConfig.EAST, # 東場と仮定 (今後の改善点)
        )

        result = calculator.estimate_hand(hand_136, win_tile_136, melds, config)

        if not result.yaku:
            return CalculationResult(yaku_list=["役なし"], han=0, fu=0, score="0点", error="成立する役がありません。")

        # 5. 結果を整形 (ツモとロンで表示を分ける)
        yaku_list_str = [y.name for y in result.yaku]
        
        # (仮) 親として計算
        is_oya = True 
        if data.is_tsumo:
            if is_oya:
                score_str = f"ツモ: {result.cost['main']}点 ALL"
            else:
                score_str = f"ツモ: {result.cost['additional']}点 - {result.cost['main']}点"
        else: # ロン
            score_str = f"ロン: {result.cost['main']}点"
        
        return CalculationResult(
            yaku_list=yaku_list_str,
            han=result.han,
            fu=result.fu,
            score=score_str,
            error=None
        )
    except ValueError:
        return CalculationResult(yaku_list=[], han=0, fu=0, score="", error="和了（あがり）の形になっていません。")
    except Exception as e:
        print(f"Unexpected Error: {e}")
        return CalculationResult(yaku_list=[], han=0, fu=0, score="", error=f"計算中に予期せぬエラーが発生しました。")
