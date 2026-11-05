// 物理・化学、燃焼・消火のアニメ教材
import { svg, text, atom, bond, flame, cross, circleOk, beaker, arrow, box, bubbles, title, h2o, o2, C } from './svg.js';

const triangle = (on = { fuel: 1, oxy: 1, heat: 1 }, burning = true, extra = '') => svg(`
  ${title(burning ? '三要素がそろう → 燃える' : '燃焼の三要素')}
  <polygon points="200,60 90,250 310,250" fill="none" stroke="#b0bec5" stroke-width="3" stroke-dasharray="6 5"/>
  <g opacity="${on.fuel ? 1 : 0.2}">${box(40, 200, 110, 56, '可燃物', { fill: '#efebe9', sub: '木・紙・油など' })}</g>
  <g opacity="${on.oxy ? 1 : 0.2}">${box(250, 200, 120, 56, '酸素供給源', { fill: '#e3f2fd', sub: '空気・酸化剤' })}</g>
  <g opacity="${on.heat ? 1 : 0.2}">${box(145, 48, 110, 56, '点火源', { fill: '#fff3e0', sub: '火花・高温' })}</g>
  ${burning ? flame(200, 200, 1.1) : ''}
  ${extra}`);

export const DEFS_CHEM = [
  {
    id: 'combustion', title: '燃焼の三要素', subject: 'chem', unitId: 'chem.combustion',
    steps: [
      { title: '3つの要素', caption: '燃焼（熱と光を出す激しい酸化反応）には「可燃物」「酸素供給源」「点火源（熱源）」の3つが同時にそろうことが必要です。', svg: () => triangle({ fuel: 1, oxy: 1, heat: 1 }, false) },
      { title: 'そろうと燃える', caption: '3つがそろうと燃焼が始まり、出た熱が次の燃焼を支えるので燃え続けます。', svg: () => triangle() },
      { title: '可燃物を取り除く', caption: '可燃物を取り除くと燃えるものがなくなり火は消えます（除去消火）。例：ガスの元栓を閉める。', svg: () => triangle({ fuel: 0, oxy: 1, heat: 1 }, false, cross(95, 228, 1.3)) },
      { title: '酸素を断つ', caption: '酸素の供給を断つと消えます（窒息消火）。例：ふたをする、泡や不燃性ガスで覆う。', svg: () => triangle({ fuel: 1, oxy: 0, heat: 1 }, false, cross(310, 228, 1.3)) },
      { title: '熱を奪う', caption: '温度を下げて燃焼が続く温度より低くすると消えます（冷却消火）。例：水をかける。', svg: () => triangle({ fuel: 1, oxy: 1, heat: 0 }, false, cross(200, 76, 1.3)) },
      { title: '第6類はどこに当たる？', caption: '第6類危険物は自らは燃えない「酸化性液体」で、三要素のうち「酸素供給源」として働き、近くの可燃物の燃焼を激しくします。', svg: () => triangle({ fuel: 1, oxy: 1, heat: 1 }, true, `<rect x="245" y="262" width="130" height="26" rx="8" fill="#3f51b5"/>${text(310, 280, '第6類はここ', { size: 13, fill: '#fff', weight: 'bold' })}`) },
    ],
  },
  {
    id: 'extinguish', title: '消火の4つの作用と消火剤', subject: 'chem', unitId: 'chem.extinguish',
    steps: [
      { title: '除去・窒息・冷却', caption: '三要素のどれか1つを取り除けば消火できます。可燃物→除去、酸素→窒息、熱→冷却。', svg: () => svg(`${title('消火の3要素')}${box(20, 70, 110, 70, '除去', { fill: '#efebe9', sub: '可燃物を断つ' })}${box(145, 70, 110, 70, '窒息', { fill: '#e3f2fd', sub: '酸素を断つ' })}${box(270, 70, 110, 70, '冷却', { fill: '#fff3e0', sub: '熱を奪う' })}${text(200, 200, '＋ 燃焼の連鎖反応を止める「抑制（負触媒）」', { size: 14, weight: 'bold' })}${text(200, 228, '除去・窒息・冷却・抑制 ＝ 消火の4作用', { size: 13, fill: C.sub })}`) },
      { title: '水・強化液', caption: '水は蒸発熱が大きく冷却効果が高い消火剤です。ただし油の火災に棒状の水をかけると油が飛び散り広がるおそれがあります。強化液は冷却に加え、霧状にすると抑制効果もあります。', svg: () => svg(`${title('水：冷却')}${beaker(150, 120, 100, 110, C.water, 0.7, '水')}${flame(200, 110, 0.8)}${arrow(120, 80, 170, 105, '#1e88e5', '熱を奪う', 110, 70)}`) },
      { title: '泡', caption: '泡は燃えている物の表面を覆って酸素を断ち（窒息）、水分による冷却効果もあります。', svg: () => svg(`${title('泡：窒息＋冷却')}<rect x="80" y="170" width="240" height="60" fill="#ffe0b2"/>${text(200, 250, '燃えている液面', { size: 12, fill: C.sub })}${[...Array(10)].map((_, k) => `<circle cx="${95 + k * 23}" cy="160" r="14" fill="#fff" stroke="#b0bec5"/>`).join('')}${text(200, 120, '泡で表面を覆う', { size: 14, weight: 'bold' })}`) },
      { title: '二酸化炭素・ハロゲン化物', caption: '二酸化炭素は酸素濃度を下げる窒息効果、ハロゲン化物は抑制（負触媒）と窒息の効果があります。密閉された場所では酸欠に注意が必要です。', svg: () => svg(`${title('CO₂：窒息　ハロゲン化物：抑制＋窒息')}${box(40, 90, 150, 90, '二酸化炭素', { fill: '#eceff1', sub: '酸素濃度を下げる' })}${box(210, 90, 150, 90, 'ハロゲン化物', { fill: '#f3e5f5', sub: '連鎖反応を止める' })}${text(200, 230, '※ 酸素を自ら出す酸化性物質には効きにくい', { size: 13, fill: C.ng })}`) },
      { title: '粉末', caption: '粉末消火剤には、りん酸塩類を主成分とするもの（普通・油・電気の火災に使える）や炭酸水素塩類などがあり、主に抑制と窒息の効果で消火します。', svg: () => svg(`${title('粉末：抑制＋窒息')}${[...Array(40)].map((_, k) => `<circle cx="${80 + (k * 53) % 240}" cy="${90 + (k * 29) % 110}" r="3" fill="#ffca28"/>`).join('')}${text(200, 240, 'りん酸塩類・炭酸水素塩類など', { size: 13 })}`) },
    ],
  },
  {
    id: 'flash-ignition', title: '引火点・発火点・燃焼範囲', subject: 'chem', unitId: 'chem.flash',
    steps: [
      { title: '引火点', caption: '引火点は、液体の表面に燃焼範囲の下限の濃度の蒸気が発生し、点火源を近づけると燃え出す最低の液温です。', svg: () => svg(`${title('引火点：火を近づけると燃える最低の液温')}${beaker(140, 150, 120, 90, '#ffe082', 0.6, '可燃性液体')}${[...Array(5)].map((_, k) => `<path d="M${160 + k * 20} 140 q 6 -14 0 -28" stroke="#bdbdbd" stroke-width="3" fill="none" class="a-pulse"/>`).join('')}${flame(300, 120, 0.6)}${text(300, 140, '点火源', { size: 12 })}`) },
      { title: '発火点', caption: '発火点は、点火源がなくても加熱されただけで自ら燃え出す最低の温度です。一般に引火点より高い温度です。', svg: () => svg(`${title('発火点：火がなくても自ら燃え出す最低温度')}${beaker(140, 150, 120, 90, '#ffe082', 0.6)}<rect x="120" y="244" width="160" height="16" fill="#ef5350"/>${text(200, 282, '加熱するだけ', { size: 13 })}${flame(200, 140, 0.8)}`) },
      { title: '燃焼範囲（爆発範囲）', caption: '可燃性蒸気と空気の混合気は、蒸気の濃度が一定の範囲（下限値〜上限値）にあるときだけ燃えます。薄すぎても濃すぎても燃えません。', svg: () => svg(`${title('燃焼範囲：濃すぎても薄すぎても燃えない')}<rect x="40" y="130" width="320" height="34" fill="#eceff1" stroke="#90a4ae"/><rect x="120" y="130" width="110" height="34" fill="#ffcc80"/>${text(120, 190, '下限値', { size: 13 })}${text(230, 190, '上限値', { size: 13 })}${text(80, 120, '薄すぎ', { size: 12, fill: C.sub })}${text(300, 120, '濃すぎ', { size: 12, fill: C.sub })}${text(175, 152, '燃える', { size: 13, weight: 'bold' })}${text(200, 240, '蒸気の濃度（容量%）→', { size: 12, fill: C.sub })}`) },
    ],
  },
  {
    id: 'states', title: '物質の三態と状態変化', subject: 'chem', unitId: 'chem.states',
    steps: [
      { title: '固体・液体・気体', caption: '粒子（分子など）の並び方と動きの激しさで状態が変わります。固体は規則正しく並び、液体は位置を変えながら動き、気体は自由に飛び回ります。', svg: () => {
        const grid = [...Array(9)].map((_, k) => `<circle cx="${50 + (k % 3) * 22}" cy="${130 + Math.floor(k / 3) * 22}" r="9" fill="#5c6bc0"/>`).join('');
        const liq = [...Array(9)].map((_, k) => `<circle cx="${170 + (k * 17) % 60}" cy="${150 + (k * 13) % 40}" r="9" fill="#5c6bc0" class="a-wob"/>`).join('');
        const gas = [...Array(6)].map((_, k) => `<circle cx="${300 + (k * 31) % 70}" cy="${100 + (k * 43) % 120}" r="9" fill="#5c6bc0" class="a-drift" style="--dx:${(k % 2 ? -1 : 1) * 14}px;--dy:${(k % 3 - 1) * 16}px"/>`).join('');
        return svg(`${title('物質の三態')}${grid}${liq}${gas}${text(72, 230, '固体', { weight: 'bold' })}${text(200, 230, '液体', { weight: 'bold' })}${text(335, 230, '気体', { weight: 'bold' })}`);
      } },
      { title: '状態変化の名前', caption: '固体→液体は融解、液体→固体は凝固、液体→気体は蒸発（気化）、気体→液体は凝縮（液化）、固体→気体は昇華です。気体→固体も昇華と呼ばれます（凝華ともいいます）。', svg: () => svg(`${title('状態変化')}${box(30, 200, 100, 50, '固体', { fill: '#e8eaf6' })}${box(150, 70, 100, 50, '液体', { fill: '#e3f2fd' })}${box(270, 200, 100, 50, '気体', { fill: '#f1f8e9' })}${arrow(90, 195, 160, 125, '#e53935', '融解', 95, 150)}${arrow(170, 125, 110, 195, '#1e88e5', '凝固', 160, 175)}${arrow(240, 125, 300, 195, '#e53935', '蒸発', 300, 150)}${arrow(290, 195, 230, 125, '#1e88e5', '凝縮', 240, 175)}${arrow(135, 225, 265, 225, '#e53935', '昇華', 200, 215)}${arrow(265, 240, 135, 240, '#1e88e5')}${text(200, 280, '赤：熱を吸収　青：熱を放出', { size: 12, fill: C.sub })}`) },
      { title: '沸点と圧力', caption: '液体の蒸気圧が外圧（大気圧）と等しくなる温度が沸点です。外圧が低いと沸点は下がり、高いと沸点は上がります。', svg: () => svg(`${title('沸点：蒸気圧 ＝ 外圧')}${beaker(140, 130, 120, 110, C.water, 0.7)}${bubbles(160, 220, 7, 80)}${arrow(200, 60, 200, 110, C.sub, '外圧', 230, 80)}${text(200, 280, '山の上（外圧が低い）では低い温度で沸騰する', { size: 13 })}`) },
    ],
  },
  {
    id: 'heat-transfer', title: '熱の移動と熱量', subject: 'chem', unitId: 'chem.heat',
    steps: [
      { title: '伝導', caption: '物体の中を高温部から低温部へ熱が伝わることです。金属は熱伝導率が大きく、熱を伝えやすい物質です。', svg: () => svg(`${title('伝導')}<defs><linearGradient id="g1"><stop offset="0" stop-color="#e53935"/><stop offset="1" stop-color="#90caf9"/></linearGradient></defs><rect x="60" y="130" width="280" height="30" fill="url(#g1)"/>${flame(60, 200, 0.7)}${arrow(100, 115, 300, 115, '#e53935', '熱が伝わる', 200, 105)}`) },
      { title: '対流', caption: '液体や気体が温められると膨張して軽くなり上昇し、冷たい部分が下がって循環しながら熱が運ばれます。', svg: () => svg(`${title('対流')}${beaker(120, 80, 160, 150, C.water, 0.85)}<path d="M200 210 C 150 200 150 110 200 100 C 250 110 250 200 200 210" fill="none" stroke="#e53935" stroke-width="3" stroke-dasharray="8 6" class="a-pulse"/>${flame(200, 260, 0.6)}`) },
      { title: '放射（ふく射）', caption: '熱が電磁波（赤外線など）として空間を伝わることです。間に物質がなくても伝わります。太陽やストーブの熱です。', svg: () => svg(`${title('放射')}<circle cx="80" cy="150" r="40" fill="#ffb300"/>${[...Array(5)].map((_, k) => arrow(130, 110 + k * 20, 290, 110 + k * 20, '#ff7043')).join('')}<rect x="300" y="100" width="40" height="100" fill="#b0bec5"/>`) },
      { title: '熱量の計算', caption: '熱量 Q ＝ 質量 m × 比熱 c × 温度変化 Δt。例：水100gを20℃から50℃にするには、比熱を約4.2 J/(g・K)とすると Q＝100×4.2×30＝12,600 J（約12.6 kJ）。比熱が大きい物質ほど温まりにくく冷めにくい。', svg: () => svg(`${title('Q ＝ m × c × Δt')}${text(200, 110, '100 g × 4.2 J/(g・K) × 30 K', { size: 18 })}${text(200, 160, '＝ 12,600 J', { size: 26, weight: 'bold', fill: '#3f51b5' })}${text(200, 220, '（水の比熱は約4.2 J/(g・K)。他の物質より大きい）', { size: 12, fill: C.sub })}`) },
    ],
  },
  {
    id: 'density', title: '密度・比重・蒸気比重', subject: 'chem', unitId: 'chem.density',
    steps: [
      { title: '密度と比重', caption: '密度＝質量÷体積。液体・固体の比重は、その物質の質量と、同じ体積の水（4℃）の質量との比です。比重が1より大きいものは水に沈み、小さいものは浮きます（水に溶けない場合）。', svg: () => svg(`${title('比重：水を1とした重さの比')}${beaker(110, 90, 180, 150, C.water, 0.8)}<rect x="140" y="128" width="40" height="22" fill="#ffcc80"/>${text(160, 120, '比重<1 浮く', { size: 12 })}<rect x="220" y="208" width="40" height="28" fill="#78909c"/>${text(240, 200, '比重>1 沈む', { size: 12 })}`) },
      { title: '第6類の比重', caption: '第6類の物質の比重はいずれも1より大きい（水より重い）。過酸化水素や硝酸は水によく溶けます。', svg: () => svg(`${title('第6類：比重はすべて1より大きい')}${box(40, 100, 100, 70, '過塩素酸', { sub: '約1.8' })}${box(150, 100, 100, 70, '硝酸', { sub: '約1.5' })}${box(260, 100, 100, 70, '過酸化水素', { sub: '1より大' })}${text(200, 230, '※値は代表的なもの（濃度などで変わる）', { size: 12, fill: C.sub })}`) },
      { title: '蒸気比重', caption: '蒸気比重は、その蒸気の重さと同じ体積の空気の重さの比です。おおよそ「分子量÷29（空気の平均分子量）」で求められます。1より大きい蒸気は低い所にたまります。', svg: () => svg(`${title('蒸気比重 ≒ 分子量 ÷ 29')}${text(200, 100, '例：二酸化炭素 CO₂ の分子量 44', { size: 15 })}${text(200, 140, '44 ÷ 29 ≒ 1.52', { size: 24, weight: 'bold', fill: '#3f51b5' })}<rect x="60" y="200" width="280" height="40" fill="#cfd8dc" opacity=".8" class="a-pulse"/>${text(200, 226, '空気より重い → 低い所にたまる', { size: 13 })}`) },
    ],
  },
  {
    id: 'static-electricity', title: '静電気の発生と防止', subject: 'chem', unitId: 'chem.static',
    steps: [
      { title: '発生', caption: '電気を通しにくい（絶縁性の高い）液体が配管の中を流れたり、物同士がこすれたりすると静電気が発生します。流速が速いほど発生しやすくなります。', svg: () => svg(`${title('流れ・摩擦で発生')}<rect x="30" y="130" width="340" height="40" fill="#fff8e1" stroke="#90a4ae" stroke-width="3"/>${[...Array(8)].map((_, k) => text(60 + k * 40, 156, k % 2 ? '＋' : '－', { size: 16, fill: k % 2 ? C.ng : '#1e88e5', weight: 'bold' })).join('')}${arrow(60, 110, 340, 110, C.sub, '速く流れるほど多く発生', 200, 100)}`) },
      { title: '蓄積と放電', caption: '発生した静電気がたまり（蓄積）、放電の火花が出ると、可燃性蒸気に引火する点火源になることがあります。乾燥しているとたまりやすくなります。', svg: () => svg(`${title('たまった電気の火花が点火源に')}<rect x="120" y="120" width="120" height="120" fill="#eceff1" stroke="#90a4ae" stroke-width="3"/>${text(180, 185, '＋＋＋', { size: 22, fill: C.ng })}<path d="M250 150 l20 10 l-10 6 l22 12" stroke="#fbc02d" stroke-width="4" fill="none" class="a-pulse"/>${text(300, 220, '火花', { size: 14 })}`) },
      { title: '防止', caption: '主な対策：接地（アース）して電気を逃がす、湿度を高くする、流速を遅くする、導電性の材料を使う、帯電防止の服や靴を着用する。', svg: () => svg(`${title('静電気の主な対策')}${box(30, 70, 160, 50, '接地（アース）', { fill: '#e8f5e9' })}${box(210, 70, 160, 50, '湿度を高くする', { fill: '#e8f5e9' })}${box(30, 140, 160, 50, '流速を遅くする', { fill: '#e8f5e9' })}${box(210, 140, 160, 50, '導電性の材料', { fill: '#e8f5e9' })}${box(120, 210, 160, 50, '帯電防止の服・靴', { fill: '#e8f5e9' })}`) },
    ],
  },
  {
    id: 'mole-calc', title: '物質量（mol）と反応の量', subject: 'chem', unitId: 'chem.atom',
    steps: [
      { title: '1 molとは', caption: '粒子 6.02×10²³ 個のまとまりが 1 mol。1 molの質量は分子量（原子量）にgをつけた値、気体なら標準状態（0℃、1気圧）で約22.4 Lです。', svg: () => svg(`${title('1 mol ＝ 6.02×10²³ 個')}${box(30, 90, 160, 70, 'H₂O 1 mol', { sub: '18 g' })}${box(210, 90, 160, 70, 'O₂ 1 mol', { sub: '32 g・約22.4 L' })}${text(200, 220, '原子量 H=1, O=16 として', { size: 13, fill: C.sub })}`) },
      { title: '反応式の係数は mol の比', caption: '2H₂ ＋ O₂ → 2H₂O では、水素2 mol と酸素1 mol が反応して水2 mol ができます。係数の比がそのまま物質量の比です。', svg: () => svg(`${title('2H₂ ＋ O₂ → 2H₂O')}${[0, 1].map((k) => `<g>${bond(40, 110 + k * 50, 60, 110 + k * 50)}${atom(40, 110 + k * 50, 10, 'H')}${atom(60, 110 + k * 50, 10, 'H')}</g>`).join('')}${o2(150, 135)}${arrow(190, 135, 240, 135)}${h2o(290, 110)}${h2o(290, 165)}${text(55, 220, '2 mol', { size: 14 })}${text(150, 220, '1 mol', { size: 14 })}${text(290, 220, '2 mol', { size: 14 })}`) },
      { title: '質量で考える', caption: '水素 4 g（2 mol）を完全に燃やすのに必要な酸素は 1 mol ＝ 32 g、できる水は 2 mol ＝ 36 g。反応の前後で質量の合計は変わりません（質量保存の法則）。', svg: () => svg(`${title('4 g ＋ 32 g → 36 g')}${text(200, 130, '水素 4 g ＋ 酸素 32 g', { size: 20 })}${text(200, 180, '→ 水 36 g', { size: 24, weight: 'bold', fill: '#3f51b5' })}${text(200, 240, '質量保存の法則', { size: 13, fill: C.sub })}`) },
    ],
  },
  {
    id: 'ph-neutral', title: '酸・塩基・pH・中和', subject: 'chem', unitId: 'chem.acid-base',
    steps: [
      { title: 'pHのものさし', caption: 'pH7が中性、7より小さいと酸性、大きいと塩基性（アルカリ性）。pHが1小さくなると水素イオン濃度は10倍になります。', svg: () => svg(`${title('pH')}<defs><linearGradient id="ph"><stop offset="0" stop-color="#e53935"/><stop offset=".5" stop-color="#66bb6a"/><stop offset="1" stop-color="#3949ab"/></linearGradient></defs><rect x="30" y="120" width="340" height="40" rx="8" fill="url(#ph)"/>${[0, 7, 14].map((v) => text(30 + v * 340 / 14, 185, v, { size: 14 })).join('')}${text(80, 105, '酸性', { weight: 'bold' })}${text(200, 105, '中性', { weight: 'bold' })}${text(320, 105, '塩基性', { weight: 'bold' })}`) },
      { title: '酸と塩基', caption: '酸は水に溶けて水素イオン H⁺ を出す物質、塩基は水酸化物イオン OH⁻ を出す（または H⁺ を受け取る）物質です。', svg: () => svg(`${title('酸 → H⁺　塩基 → OH⁻')}${box(40, 100, 140, 80, 'HCl', { fill: '#ffebee', sub: 'H⁺ ＋ Cl⁻' })}${box(220, 100, 140, 80, 'NaOH', { fill: '#e8eaf6', sub: 'Na⁺ ＋ OH⁻' })}`) },
      { title: '中和', caption: '酸と塩基が反応して塩と水ができる反応が中和です。HCl ＋ NaOH → NaCl ＋ H₂O。H⁺ ＋ OH⁻ → H₂O が本質です。', svg: () => svg(`${title('H⁺ ＋ OH⁻ → H₂O')}${text(200, 120, 'HCl ＋ NaOH → NaCl ＋ H₂O', { size: 18 })}${h2o(200, 180, 1.4)}${text(200, 250, '酸 ＋ 塩基 → 塩 ＋ 水', { size: 14, fill: C.sub })}`) },
    ],
  },
  {
    id: 'redox', title: '酸化と還元', subject: 'chem', unitId: 'chem.redox',
    steps: [
      { title: '酸素のやり取り', caption: '物質が酸素と結びつくことを酸化、酸素を失うことを還元といいます。2Cu ＋ O₂ → 2CuO では銅が酸化されています。', svg: () => svg(`${title('2Cu ＋ O₂ → 2CuO')}${atom(70, 140, 16, 'Cu')}${atom(110, 140, 16, 'Cu')}${o2(180, 140)}${arrow(215, 140, 255, 140)}${atom(290, 120, 16, 'Cu')}${atom(320, 120, 12, 'O')}${atom(290, 170, 16, 'Cu')}${atom(320, 170, 12, 'O')}${text(200, 230, '銅は酸素と結びついた ＝ 酸化された', { size: 14 })}`) },
      { title: '同時に起こる', caption: 'CuO ＋ H₂ → Cu ＋ H₂O では、酸化銅は酸素を失い還元され、水素は酸素と結びつき酸化されます。酸化と還元は必ず同時に起こります。', svg: () => svg(`${title('CuO ＋ H₂ → Cu ＋ H₂O')}${text(200, 110, '酸化銅：酸素を失う → 還元', { size: 15, fill: '#1e88e5' })}${text(200, 150, '水素：酸素を得る → 酸化', { size: 15, fill: C.ng })}${text(200, 220, '酸化と還元は同時に起こる', { size: 16, weight: 'bold' })}`) },
      { title: '電子で考える', caption: '電子を失うことが酸化、電子を受け取ることが還元です。相手を酸化して自分は還元される物質を酸化剤といいます。第6類（酸化性液体）は強い酸化剤です。', svg: () => svg(`${title('酸化剤は相手から電子を奪う')}${box(40, 100, 130, 80, '還元剤', { fill: '#fff3e0', sub: '電子を渡す（酸化される）' , size: 14})}${box(230, 100, 130, 80, '酸化剤', { fill: '#e8eaf6', sub: '電子を受取る（還元される）', size: 14 })}${arrow(175, 140, 225, 140, '#3f51b5', 'e⁻', 200, 128)}${text(200, 240, '第6類 ＝ 強い酸化剤', { size: 15, weight: 'bold', fill: '#3f51b5' })}`) },
    ],
  },
  {
    id: 'metal-ionization', title: 'イオン化傾向と金属の腐食', subject: 'chem', unitId: 'chem.metal',
    steps: [
      { title: 'イオン化傾向', caption: '金属が水溶液中で陽イオンになろうとする性質の強さの順です。K＞Ca＞Na＞Mg＞Al＞Zn＞Fe＞Ni＞Sn＞Pb＞(H₂)＞Cu＞Hg＞Ag＞Pt＞Au。左ほど反応しやすく、さびやすい。', svg: () => svg(`${title('イオン化傾向（大 → 小）')}${['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb', 'H₂', 'Cu', 'Hg', 'Ag', 'Pt', 'Au'].map((m, k) => text(25 + k * 23.5, 150, m, { size: 13, weight: 'bold', fill: m === 'H₂' ? C.sub : C.ink })).join('')}${arrow(30, 180, 370, 180, C.sub)}${text(60, 210, '反応しやすい', { size: 12 })}${text(340, 210, '反応しにくい', { size: 12 })}`) },
      { title: '異なる金属が接すると', caption: '鉄と銅のように異なる金属が水分を介して接していると、イオン化傾向の大きい鉄のほうが腐食しやすくなります。', svg: () => svg(`${title('鉄 × 銅 → 鉄が腐食')}<rect x="80" y="120" width="120" height="60" fill="${C.Fe}"/><rect x="200" y="120" width="120" height="60" fill="${C.Cu}"/>${text(140, 156, '鉄', { fill: '#fff', weight: 'bold' })}${text(260, 156, '銅', { fill: '#fff', weight: 'bold' })}${[...Array(5)].map((_, k) => `<circle cx="${100 + k * 20}" cy="${190 + (k % 2) * 6}" r="5" fill="#a1471e" class="a-pulse"/>`).join('')}${text(200, 240, 'イオン化傾向が大きい金属が先にさびる', { size: 13 })}`) },
      { title: '防食', caption: '鉄に亜鉛をめっきする（トタン）と、亜鉛が先に溶けて鉄を守ります。塗装・めっきで水や酸素を遮るのも防食の方法です。', svg: () => svg(`${title('亜鉛めっき：亜鉛が身代わりに')}<rect x="80" y="140" width="240" height="50" fill="${C.Fe}"/><rect x="80" y="126" width="240" height="14" fill="#b0bec5"/>${text(200, 122, '亜鉛', { size: 13 })}${text(200, 172, '鉄', { fill: '#fff', weight: 'bold' })}`) },
    ],
  },
];
