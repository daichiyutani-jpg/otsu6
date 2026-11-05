# 乙六アプリ 教材・問題データ仕様（執筆者向け）

対象：危険物取扱者 乙種第6類。正確さが最優先。数より正確さ。迷う事実は問題にしない。

## 公式情報（2026-11-06 確認・消防試験研究センター）
- 法令15問／物理学及び化学10問／性質・火災予防・消火10問、計35問、五肢択一、2時間。
- 合格：科目ごとに60%以上。
- 公式過去問PDFは「教育目的（非営利）以外の複製・転用禁止」→ **本アプリには公式問題文を一切転載しない**。問題文・選択肢は必ず自分の言葉で新規に作る（テーマが過去によく問われるものでもよい）。

## ファイル
各担当は `otsu6/shared/data/content/<担当ID>.json` を **1ファイル** で書く（UTF-8、JSONとして正しいこと）。

```json
{
  "contentId": "law-1",
  "units": [ ...単元 ],
  "questions": [ ...問題 ]
}
```

## 単元（unit）
```json
{
  "id": "law.quantity",
  "subject": "law",            // law | chem | prop
  "order": 2,                   // 科目内の並び順（担当表の番号）
  "title": "指定数量と倍数計算",
  "importance": 3,              // 3=最重要 2=重要 1=標準
  "summary": "1〜2文の要約",
  "keyPoints": ["合格特化型の『重要事項』。1項目1〜2文、試験に出る数値・語句を正確に。8〜15項目"],
  "lecture": [ ブロック... ],   // 完全学習型の基礎講義。初心者向けに丁寧に。15〜40ブロック
  "animationIds": ["designated-qty"],
  "sources": [{"name":"消防法 別表第一", "url":"https://elaws.e-gov.go.jp/document?lawid=323AC1000000186", "checkedDate":"2026-11-06"}]
}
```

lecture ブロックの種類：
- `{"type":"h","text":"見出し"}`
- `{"type":"p","text":"段落"}`
- `{"type":"list","items":["…","…"]}`
- `{"type":"table","head":["物質","化学式"],"rows":[["硝酸","HNO₃"]]}`
- `{"type":"formula","text":"2H₂O₂ → 2H₂O + O₂","note":"任意の説明"}`
- `{"type":"point","text":"試験ポイント（よく問われる所）"}`
- `{"type":"warn","text":"間違えやすい所・ひっかけ"}`
- `{"type":"step","title":"手順名","items":["1つめ","2つめ"]}`（計算の段階説明など）
- `{"type":"anim","id":"h2o2-decomp"}`（アニメ教材の埋め込み。下の一覧のIDのみ）

化学式の数字は **Unicode下付き**（H₂O₂、HNO₃、BrF₃、O₂、CO₂）。イオンは Na⁺、Cl⁻、SO₄²⁻。

法令の出典URL：消防法 `https://elaws.e-gov.go.jp/document?lawid=323AC1000000186`、危険物の規制に関する政令 `https://elaws.e-gov.go.jp/document?lawid=334CO0000000306`、危険物の規制に関する規則 `https://elaws.e-gov.go.jp/document?lawid=334M50000002055`。物理化学・性質は出典を「一般的な化学の知識」としてよい（url は null 可）。**確かでないURLや条番号は書かない。**

## 問題（question）
```json
{
  "questionId": "law-S-001",
  "questionType": "similar",
  "subject": "law",
  "topic": "law.quantity",
  "level": "standard",
  "questionText": "問題文",
  "choices": ["…","…","…","…","…"],
  "correctAnswer": 2,
  "explanation": "正解の理由と、覚えるべき要点。2〜5文。",
  "choiceExplanations": ["選択肢1がなぜ正しい/誤りか", "…", "…", "…", "…"],
  "choiceCauses": ["law_number", null, "law_number", "term", "misread"],
  "difficulty": 2,
  "importance": 3,
  "sourceName": "オリジナル（本アプリ作成）",
  "sourceUrl": null,
  "examYear": null,
  "sourceVerificationStatus": "original",
  "reproductionPermissionStatus": "not_applicable",
  "animationId": null,
  "relatedQuestionIds": [],
  "lastVerifiedDate": "2026-11-06"
}
```

- `questionId`：`<科目>-<種別記号>-<担当番号><連番3桁>`。種別記号 B=basic, S=similar, M=mock。例 `law-B-1001`（law-1担当の basic 1問目）、`law-S-2015`（law-2担当の similar 15問目）。重複禁止。
- `questionType`：
  - `basic`：基礎知識の学習問題。**4択**。一問一答・講義の確認用。
  - `similar`：過去によく問われるテーマを参考にした独自作成の類題。**5択**、本番レベル。
  - `mock`：模擬試験専用の独自問題。**5択**、本番レベル。similarと同じテーマでも問い方・数値・角度を変える。
  - `past`（実際の過去問）は **作らない**。
- `level`：`basic`（基礎）/ `standard`（標準）/ `applied`（応用：組み合わせ・計算・ひっかけ）。basic型は主に basic、similar/mock は standard と applied を混ぜる。
- `correctAnswer`：0始まりの添字。正解位置は偏らせない（5択なら各位置がほぼ均等）。アプリ側でもシャッフルする。
- 本番でよくある形式も使う：「正しいものはどれか」「誤っているものはどれか」「正しいものの組合せ」「A〜Eのうち正しいものはいくつあるか」「計算値」。否定形（誤っているもの）は問題文で **「誤っているもの」** と明示。
- `choiceExplanations`：全選択肢ぶん。正解の選択肢にも理由を書く。
- `choiceCauses`：その誤選択肢を選んだ人に考えられる原因。正解の位置は null。値は次のどれか：
  - `term` 用語の理解不足 / `formula` 化学式の暗記不足 / `substance_mixup` 物質ごとの性質の混同 / `extinguish_mixup` 消火方法の混同 / `law_number` 法令の数値の混同 / `law_procedure` 手続き・届出先・許可権者の混同 / `calc` 計算方法の理解不足 / `misread` 問題文の読み違い（否定形の見落としなど）
- `difficulty`：1易〜3難。`importance`：3=頻出・最重要 2=重要 1=標準。
- `animationId`：関連するアニメがあれば下の一覧から。無ければ null。各アニメIDにつき、担当分の中で最低2問は紐づける（そのアニメの確認問題になる）。
- `relatedQuestionIds`：同じ知識を問う自分の担当分の問題ID（任意）。

## アニメ教材ID一覧（これ以外は使わない）
| ID | 内容 |
|---|---|
| combustion | 燃焼の三要素と、要素を取り除くと消える様子 |
| extinguish | 消火の4作用（除去・窒息・冷却・抑制）と消火剤の比較 |
| class6-extinguish | 第6類の物質ごとの適切／不適切な消火方法 |
| flash-ignition | 引火点・発火点・燃焼範囲 |
| states | 物質の三態と状態変化（融解・凝固・蒸発・凝縮・昇華） |
| heat-transfer | 伝導・対流・放射、比熱と熱量 Q=mcΔt |
| density | 密度・比重・液比重と蒸気比重 |
| static-electricity | 静電気の発生と蓄積・防止 |
| mole-calc | 物質量（mol）と化学反応式の量計算 |
| ph-neutral | 酸・塩基・pH・中和 |
| redox | 酸化と還元（酸素・水素・電子のやり取り） |
| metal-ionization | イオン化傾向と金属の腐食 |
| class-overview | 第1類〜第6類の性質の比較 |
| oxidizer-liquid | 第6類共通：自らは燃えないが可燃物を燃やす |
| h2o2-decomp | 過酸化水素の分解（反応前→中→後、触媒、ガス抜き栓） |
| nitric-acid | 硝酸の光・熱分解と褐色瓶、不動態、金属との反応 |
| perchloric-acid | 過塩素酸の不安定性・加熱分解・可燃物との接触 |
| halogen-fluoride | ハロゲン間化合物と水の激しい反応（ふっ化水素の発生） |
| designated-qty | 指定数量の倍数計算 |
| facility-types | 製造所・貯蔵所7種・取扱所4種の区分 |
| transport | 運搬（容器・表示・混載・遮光）と移送の違い |

## 正確さの約束
- 法令は現行法（2026-11時点）。改正で変わった古い値を使わない。自信のない数値・例外は出題しない。
- 第6類の消火：物質ごとに違う。特に **ハロゲン間化合物は水・泡が不適（粉末(りん酸塩類等)・乾燥砂）**。過酸化水素・硝酸・過塩素酸は大量の水による消火が基本。第6類全般に **二酸化炭素・ハロゲン化物消火剤は不適**。「酸化性だから全部同じ」と一般化しない。
- 他の選択肢の誤りの理由が書けない問題は作らない。
- 模式的な説明は「模式的に」と書く。
- 同じ知識を同じ問い方で何問も作らない（数値・角度・組み合わせを変える）。
- 全問、答えを自分で解き直して確認してから書く。
