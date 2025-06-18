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

# --- データ構造の定義 (フロントエンドと共通) ---
class Tile(BaseModel):
    type: str
    value: int
    is_red: Optional[bool] = Field(False, alias='isRed')

class Furo(BaseModel): # フロントのMeldはFuro(副露)と命名変更
    type: str
    tiles: List[Tile]

class HandData(BaseModel):
    hand: List[Tile]
    furo: List[Furo]
    # 今後、他の情報も追加していく
    # win_tile: Tile
    # dora_indicators: List[Tile]
    # is_tsumo: bool

# --- APIレスポンスのデータ構造 ---
class CalculationResult(BaseModel):
    yaku_list: List[str] = Field(description="成立役のリスト")
    han: int = Field(description="合計翻数")
    fu: int = Field(description="合計符")
    score: str = Field(description="点数")
    error: Optional[str] = None


# --- データ変換ヘルパー ---
def convert_to_library_format(tiles: List[Tile]) -> List[int]:
    """フロントエンドのTileリストをmahjongライブラリの整数リストに変換"""
    tile_strings = []
    for tile in tiles:
        # 赤ドラは '0m', '0p', '0s' で表現
        value = '0' if tile.is_red else str(tile.value)
        tile_strings.append(f'{value}{tile.type}')
    return TilesConverter.string_to_136_array(tile_strings)

def convert_furo_to_library_format(furo_list: List[Furo]) -> List[Meld]:
    """フロントエンドのFuroリストをmahjongライブラリのMeldリストに変換"""
    melds = []
    for f in furo_list:
        meld_tiles_136 = convert_to_library_format(f.tiles)
        # typeから適切なMeldクラスを選択
        meld_type_map = {
            'pon': Meld.PON,
            'chi': Meld.CHI,
            'kan': Meld.KAN, # 将来的には暗槓・明槓を区別
        }
        # ここでは明槓(open kan)と仮定
        is_open = f.type != 'ankan' # ankan(暗槓)というtypeを将来的に追加する想定
        melds.append(Meld(meld_type_map.get(f.type, Meld.KAN), tiles=meld_tiles_136, opened=is_open))
    return melds


# --- FastAPI アプリケーション ---
calculator = HandCalculator()

@app.post("/calculate", response_model=CalculationResult)
async def calculate_score(data: HandData):
    """手牌と副露の情報を受け取り、点数計算の結果を返す"""
    
    try:
        # 1. データをライブラリの形式に変換
        hand_136 = convert_to_library_format(data.hand)
        melds = convert_furo_to_library_format(data.furo)
        
        # 2. 和了牌を決定（手牌の最後の牌を仮定）
        #    将来的にはUIで指定できるようにする必要がある
        if not hand_136:
            raise ValueError("手牌がありません。")
        win_tile_136 = hand_136[-1]
        
        # is_agariによる事前チェックを削除

        # 3. 点数計算の設定 (今後UIから受け取る)
        config = HandConfig(
            is_tsumo=False, # ツモ or ロン
            is_riichi=False, # リーチ
            player_wind=HandConfig.EAST, # 自風
            round_wind=HandConfig.EAST, # 場風
        )

        # 4. 点数計算を実行
        result: HandResponse = calculator.estimate_hand(hand_136, win_tile_136, melds, config)

        if not result.yaku:
            return CalculationResult(yaku_list=["役なし"], han=0, fu=0, score="0点", error="成立する役がありません。")

        # 5. 結果をフロントエンド用の形式に整形
        yaku_list_str = [y.name for y in result.yaku]
        # ロン・ツモの点数表示
        score_str = f"ロン: {result.cost['main']}点" # 親子関係で変動
        
        return CalculationResult(
            yaku_list=yaku_list_str,
            han=result.han,
            fu=result.fu,
            score=score_str
        )

    except ValueError as e:
        # 和了形でない場合、ライブラリはValueErrorを発生させることが多い
        print(f"ValueError: {e}")
        return CalculationResult(
            yaku_list=["エラー"], han=0, fu=0, score="", error="和了（あがり）の形になっていません。"
        )
    except Exception as e:
        # その他の予期せぬエラー
        print(f"Unexpected Error: {e}")
        return CalculationResult(
            yaku_list=["エラー"], han=0, fu=0, score="", error=f"計算中に予期せぬエラーが発生しました。"
        )

# サーバー起動コマンド: uvicorn main:app --reload
