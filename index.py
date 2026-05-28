from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Japanese fonts
pdfmetrics.registerFont(TTFont('NotoSansJP', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('NotoSansJP-Bold', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', subfontIndex=0))

# Color palette
DARK_BG = colors.HexColor('#1a1f2e')
ACCENT = colors.HexColor('#5b7fff')
ACCENT_LIGHT = colors.HexColor('#e8eeff')
TEAL = colors.HexColor('#26d4b8')
TEAL_LIGHT = colors.HexColor('#e6faf7')
AMBER = colors.HexColor('#f5a623')
AMBER_LIGHT = colors.HexColor('#fef6e6')
CORAL = colors.HexColor('#ff6b7a')
CORAL_LIGHT = colors.HexColor('#fff0f1')
GREEN = colors.HexColor('#4ade80')
GREEN_LIGHT = colors.HexColor('#edfff5')
PURPLE = colors.HexColor('#a78bfa')
PURPLE_LIGHT = colors.HexColor('#f4f0ff')
GRAY_LIGHT = colors.HexColor('#f5f6fa')
GRAY_MID = colors.HexColor('#e2e4ec')
GRAY_DARK = colors.HexColor('#8892a4')
TEXT_DARK = colors.HexColor('#1a1f2e')
TEXT_MID = colors.HexColor('#3a4155')
WHITE = colors.white

WIDTH, HEIGHT = A4

def make_styles():
    base = {'fontName': 'NotoSansJP', 'fontSize': 10, 'leading': 16}
    def s(**kw): return ParagraphStyle('', **{**base, **kw})
    return {
        'title': s(fontName='NotoSansJP-Bold', fontSize=24, leading=32, textColor=WHITE, spaceAfter=4),
        'subtitle': s(fontSize=13, leading=20, textColor=colors.HexColor('#c5ccdc'), spaceAfter=2),
        'meta': s(fontSize=10, leading=14, textColor=colors.HexColor('#8892a4')),
        'h1': s(fontName='NotoSansJP-Bold', fontSize=15, leading=22, textColor=ACCENT, spaceBefore=18, spaceAfter=8),
        'h2': s(fontName='NotoSansJP-Bold', fontSize=12, leading=18, textColor=TEXT_DARK, spaceBefore=14, spaceAfter=6),
        'h3': s(fontName='NotoSansJP-Bold', fontSize=11, leading=16, textColor=TEXT_MID, spaceBefore=10, spaceAfter=4),
        'body': s(fontSize=10, leading=16, textColor=TEXT_MID, spaceAfter=4),
        'bullet': s(fontSize=10, leading=16, textColor=TEXT_MID, leftIndent=14, spaceAfter=2, bulletIndent=4),
        'bullet2': s(fontSize=9.5, leading=15, textColor=GRAY_DARK, leftIndent=28, spaceAfter=2, bulletIndent=18),
        'caption': s(fontSize=8.5, leading=13, textColor=GRAY_DARK, spaceAfter=2),
        'badge': s(fontName='NotoSansJP-Bold', fontSize=9, leading=12, textColor=WHITE),
        'table_hdr': s(fontName='NotoSansJP-Bold', fontSize=9.5, leading=14, textColor=WHITE),
        'table_cell': s(fontSize=9.5, leading=14, textColor=TEXT_MID),
        'toc_item': s(fontSize=10, leading=18, textColor=TEXT_MID),
        'note': s(fontSize=9.5, leading=14, textColor=GRAY_DARK, leftIndent=10, spaceAfter=2),
    }

ST = make_styles()

def P(text, style='body'):
    return Paragraph(text, ST[style])

def H1(text): return Paragraph(text, ST['h1'])
def H2(text): return Paragraph(text, ST['h2'])
def H3(text): return Paragraph(text, ST['h3'])
def Sp(h=6): return Spacer(1, h)
def HR(color=ACCENT, thickness=0.5): return HRFlowable(width='100%', thickness=thickness, color=color, spaceAfter=8, spaceBefore=4)

def feature_table(rows, col_widths=None):
    if col_widths is None:
        col_widths = [55*mm, 40*mm, 60*mm]
    data = [
        [P('機能名', 'table_hdr'), P('優先度', 'table_hdr'), P('概要', 'table_hdr')]
    ] + [[P(r[0], 'table_cell'), P(r[1], 'table_cell'), P(r[2], 'table_cell')] for r in rows]
    style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), ACCENT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, ACCENT_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('ROUNDEDCORNERS', [4]),
    ])
    return Table(data, colWidths=col_widths, style=style)

def req_table(rows):
    data = [
        [P('要件ID', 'table_hdr'), P('要件名', 'table_hdr'), P('詳細', 'table_hdr'), P('備考', 'table_hdr')]
    ] + [[P(r[0], 'table_cell'), P(r[1], 'table_cell'), P(r[2], 'table_cell'), P(r[3] if len(r)>3 else '', 'table_cell')] for r in rows]
    style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TEXT_DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ])
    return Table(data, colWidths=[22*mm, 35*mm, 80*mm, 28*mm], style=style)

def colored_box(text, bg, text_color=TEXT_DARK, bold=False):
    sname = 'h3' if bold else 'body'
    p = Paragraph(text, ParagraphStyle('', fontName='NotoSansJP-Bold' if bold else 'NotoSansJP',
                                        fontSize=10, leading=15, textColor=text_color))
    t = Table([[p]], colWidths=[165*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('ROUNDEDCORNERS', [5]),
    ]))
    return t

def cover_block():
    """Cover page as a wide table"""
    title_p = Paragraph('oku株式会社<br/>社長サポートシステム<br/>機能要件定義書', ST['title'])
    sub_p = Paragraph('President Support System — Functional Requirements Specification', ST['subtitle'])
    meta_p = Paragraph('バージョン: v3.0　　策定日: 2026年5月28日　　対象: だいや（社長サポート責任者）', ST['meta'])
    inner = Table([[title_p], [Sp(6)], [sub_p], [Sp(10)], [HR(colors.HexColor('#3a4a6e'), 0.8)], [Sp(6)], [meta_p]],
                  colWidths=[165*mm])
    inner.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#0c0e12')),
                                ('TOPPADDING',(0,0),(-1,-1),0), ('BOTTOMPADDING',(0,0),(-1,-1),0),
                                ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[165*mm])
    outer.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,-1),DARK_BG),
        ('TOPPADDING',(0,0),(-1,-1),28), ('BOTTOMPADDING',(0,0),(-1,-1),28),
        ('LEFTPADDING',(0,0),(-1,-1),24), ('RIGHTPADDING',(0,0),(-1,-1),24),
        ('ROUNDEDCORNERS',[8]),
    ]))
    return outer

def toc_table():
    rows = [
        ['1', 'システム概要', '3'],
        ['2', 'ユーザー・利用環境', '3'],
        ['3', '機能一覧', '4'],
        ['4', '機能詳細要件', '4〜12'],
        ['　4.1', 'ダッシュボード', '4'],
        ['　4.2', '書類スピード生成', '5'],
        ['　4.3', '契約書ウィザード', '6'],
        ['　4.4', 'イベント運営管理', '7'],
        ['　4.5', 'クライアント管理', '8'],
        ['　4.6', 'フォローアップ管理', '9'],
        ['　4.7', 'SNS管理', '10'],
        ['　4.8', 'スケジュール管理', '11'],
        ['　4.9', '財務ダッシュボード', '12'],
        ['5', 'データ管理・状態保持', '12'],
        ['6', '非機能要件', '13'],
        ['7', '画面構成・ナビゲーション', '13'],
        ['8', '用語集', '14'],
    ]
    data = [[P(r[0], 'toc_item'), P(r[1], 'toc_item'), P(r[2], 'toc_item')] for r in rows]
    style = TableStyle([
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, GRAY_MID),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ])
    return Table(data, colWidths=[18*mm, 130*mm, 17*mm], style=style)

def build_pdf(path):
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
        title='oku株式会社 社長サポートシステム 機能要件定義書',
        author='oku株式会社',
    )

    story = []

    # ── COVER ──────────────────────────────────────────────────────────────
    story.append(Sp(20))
    story.append(cover_block())
    story.append(Sp(20))

    # Summary badges row
    badge_data = [
        [colored_box('📋  対象システム: oku株式会社 社長サポートシステム v3.0', ACCENT_LIGHT),
         colored_box('👤  利用者: だいや（社長サポート責任者）', TEAL_LIGHT)],
    ]
    bt = Table(badge_data, colWidths=[82*mm, 83*mm], hAlign='LEFT')
    bt.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0),
                             ('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),4)]))
    story.append(bt)
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ───────────────────────────────────────────────────
    story.append(H1('目次'))
    story.append(HR())
    story.append(toc_table())
    story.append(PageBreak())

    # ── 1. システム概要 ───────────────────────────────────────────────────────
    story.append(H1('1. システム概要'))
    story.append(HR())
    story.append(colored_box(
        '本システムは、oku株式会社の社長（奥村航稀）が抱える「業務上の煩雑な作業」を、'
        '社長サポート責任者「だいや」が一元的に管理・実行するための専用Webアプリケーションです。'
        '社長の判断・確認業務に集中できる環境を提供し、書類作成・クライアント管理・イベント運営・SNS運用などの'
        '実務をすべて本システム上で完結させることを目的とします。',
        ACCENT_LIGHT
    ))
    story.append(Sp(10))

    story.append(H2('目的と背景'))
    story.append(P('oku株式会社は年間売上30億円・経常利益率60%・年間取引件数12,000件（月平均1,000件・平均単価30万円〜）規模の企業です。社長の多忙な業務を支えるため、以下の課題解決を目的として本システムを構築します。', 'body'))
    story.append(P('・ 書類作成（見積書・請求書・契約書）の属人化・手間を排除', 'bullet'))
    story.append(P('・ クライアント情報とフォローアップの一元管理', 'bullet'))
    story.append(P('・ イベント運営準備のチェックリスト管理', 'bullet'))
    story.append(P('・ SNS投稿スケジュールの可視化', 'bullet'))
    story.append(P('・ スケジュール・財務情報のダッシュボード化', 'bullet'))

    story.append(H2('システム種別'))
    info_rows = [
        ['種別', 'シングルページWebアプリケーション（SPA）— HTMLファイル単体で動作'],
        ['動作環境', 'モダンブラウザ（Chrome / Safari / Edge 最新版）'],
        ['ホスティング', 'ローカルファイル起動またはWebサーバー展開（認証なし）'],
        ['データ保持', 'ブラウザのlocalStorageを使用（oku_v3キー）'],
        ['外部連携', 'Google Docsリンク生成（URL形式による書類プレビュー）'],
        ['バージョン', 'v3.0（だいや専用カスタマイズ版）'],
    ]
    t = Table([[P(r[0], 'table_hdr'), P(r[1], 'table_cell')] for r in info_rows],
              colWidths=[40*mm, 125*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), TEXT_DARK),
        ('ROWBACKGROUNDS', (1,0), (1,-1), [WHITE, GRAY_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(t)

    # ── 2. ユーザー ─────────────────────────────────────────────────────────
    story.append(H1('2. ユーザー・利用環境'))
    story.append(HR())

    user_rows = [
        [P('ユーザー区分', 'table_hdr'), P('対象者', 'table_hdr'), P('主な操作', 'table_hdr'), P('権限', 'table_hdr')],
        [P('主ユーザー', 'table_cell'), P('だいや（社長サポート責任者）', 'table_cell'),
         P('全機能の登録・編集・削除・書類生成', 'table_cell'), P('フル操作権限', 'table_cell')],
        [P('閲覧者', 'table_cell'), P('社長（奥村航稀）', 'table_cell'),
         P('書類確認・スケジュール確認（参照目的）', 'table_cell'), P('確認・承認のみ', 'table_cell')],
    ]
    ut = Table(user_rows, colWidths=[30*mm, 45*mm, 65*mm, 25*mm])
    ut.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), ACCENT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, ACCENT_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(ut)
    story.append(Sp(8))
    story.append(colored_box('📌 ルール: 生成した書類のたたき台は必ず社長に確認してもらい、先方への送付は社長から行う。だいやから直接送付しない。', AMBER_LIGHT))

    # ── 3. 機能一覧 ─────────────────────────────────────────────────────────
    story.append(H1('3. 機能一覧'))
    story.append(HR())
    story.append(feature_table([
        ['ダッシュボード', '★ 高', 'KPI・クイックアクション・イベント進捗を一覧表示'],
        ['書類スピード生成', '★★ 最高', '見積書・請求書・発注書・NDA・業務報告書をGoogle Docs出力'],
        ['契約書ウィザード', '★★ 最高', '業務委託契約書（第1〜14条）を3ステップで自動生成'],
        ['イベント運営管理', '★★ 最高', 'イベント情報・チェックリスト・進捗管理'],
        ['クライアント管理', '★ 高', 'クライアント情報・案件ステータス・ヒアリング記録管理'],
        ['フォローアップ管理', '★ 高', 'リード→商談化のアクション管理・優先度管理'],
        ['SNS管理', '★ 高', '4媒体×4カテゴリの投稿スケジュール管理'],
        ['スケジュール管理', '★ 高', 'カレンダー表示・予定追加・種別管理'],
        ['財務ダッシュボード', '● 中', '月次売上トレンド・KPI表示・未入金アラート'],
    ], [60*mm, 35*mm, 70*mm]))
    story.append(PageBreak())

    # ── 4. 機能詳細要件 ─────────────────────────────────────────────────────
    story.append(H1('4. 機能詳細要件'))
    story.append(HR())

    # 4.1 ダッシュボード
    story.append(H2('4.1 ダッシュボード'))
    story.append(P('システム起動時のデフォルト画面。社長サポート業務全体の状況を一覧で把握できるホーム画面。', 'body'))
    story.append(H3('KPIメトリクス表示'))
    story.append(req_table([
        ['REQ-D01', '今期売上表示', '固定値 ¥30.0億・経常利益率60% を表示', ''],
        ['REQ-D02', 'アクティブ案件数', '商談中・契約済・納品中のクライアント件数を動的に集計', 'リアルタイム集計'],
        ['REQ-D03', 'フォロー待ち件数', '未完了フォローアップ件数を赤色で強調表示', ''],
        ['REQ-D04', '次イベントまでの日数', '最も近いイベント日程を計算し日数を表示', 'イベント名も表示'],
        ['REQ-D05', '年間取引件数', '固定値 12,000件 を表示', ''],
    ]))
    story.append(Sp(8))
    story.append(H3('クイックアクション'))
    story.append(req_table([
        ['REQ-D06', '契約書作成ショートカット', '契約書ウィザードページへ直接遷移', ''],
        ['REQ-D07', '請求書・見積書ショートカット', '書類生成ページを請求書選択状態で開く', ''],
        ['REQ-D08', 'クライアント追加ショートカット', 'クライアント管理ページを新規追加モーダル展開状態で開く', ''],
        ['REQ-D09', 'フォローアップショートカット', 'フォローアップページへ遷移', ''],
        ['REQ-D10', 'イベント運営準備ショートカット', 'イベント運営管理ページへ遷移', ''],
        ['REQ-D11', 'SNS投稿管理ショートカット', 'SNS管理ページへ遷移', ''],
    ]))
    story.append(Sp(8))
    story.append(H3('イベント準備進捗'))
    story.append(req_table([
        ['REQ-D12', 'チェックリスト進捗バー', '各イベントのチェックリスト完了率をプログレスバーで表示', 'パーセント表示'],
        ['REQ-D13', '直近クライアント一覧', '最新登録クライアント3件を表示', ''],
        ['REQ-D14', '直近タスク一覧', '当月のスケジュール予定を表示', ''],
        ['REQ-D15', '現在日時表示', 'ページ右上に現在日時をリアルタイム表示', ''],
    ]))

    story.append(PageBreak())

    # 4.2 書類スピード生成
    story.append(H2('4.2 書類スピード生成'))
    story.append(P('見積書・請求書・発注書・NDA・業務報告書の5種類の書類をフォーム入力から自動生成し、Google Docsで出力する機能。', 'body'))
    story.append(colored_box('💡 業務委託契約書（第1〜14条）は「契約書ウィザード」ページで別途対応。', TEAL_LIGHT))
    story.append(Sp(8))
    story.append(H3('書類種別選択'))
    story.append(req_table([
        ['REQ-DOC01', '書類種別選択', '見積書 / 請求書 / 発注書 / NDA（秘密保持）/ 業務報告書 から選択', 'タブUI'],
        ['REQ-DOC02', 'フォーム動的切替', '選択した書類種別に応じてフォームタイトルを動的に変更', ''],
    ]))
    story.append(Sp(6))
    story.append(H3('入力フォーム'))
    story.append(req_table([
        ['REQ-DOC03', '宛先入力', '企業名・担当者名を入力', '必須項目'],
        ['REQ-DOC04', '日付入力', '発行日・有効期限/支払期限を入力', 'date型'],
        ['REQ-DOC05', '明細行管理', '内容名・数量・単価を入力。行の追加・削除が可能', ''],
        ['REQ-DOC06', '金額自動計算', '数量×単価の小計・消費税(10%)・合計を自動計算・リアルタイム表示', ''],
        ['REQ-DOC07', '備考入力', '振込先・支払条件・補足を自由記述', '任意'],
    ]))
    story.append(Sp(6))
    story.append(H3('出力機能'))
    story.append(req_table([
        ['REQ-DOC08', 'プレビュー表示', '書類のテキスト形式プレビューをモーダルで表示', ''],
        ['REQ-DOC09', 'Google Docs出力', '入力内容を基にGoogle Docsのエンコード済みURLを生成しブラウザで開く', '社長確認用'],
    ]))

    story.append(PageBreak())

    # 4.3 契約書ウィザード
    story.append(H2('4.3 契約書ウィザード'))
    story.append(P('業務委託契約書（第1〜14条）を3ステップのウィザード形式で自動生成する機能。', 'body'))
    story.append(req_table([
        ['REQ-CON01', 'ステップ1: 基本情報', '委託者（先方）企業名・代表者名・住所、受託者（oku株式会社）、契約開始日・期間を入力', ''],
        ['REQ-CON02', 'ステップ2: 業務内容・報酬', '委託業務（SNS運用/HP制作/AI導入支援/OEM提供等チップ選択＋自由記述）、報酬形態（月額固定/成果報酬/スポット）、支払条件、秘密保持、禁止事項、競業避止を設定', ''],
        ['REQ-CON03', 'ステップ3: 条項確認・生成', '入力内容から第1〜14条を含む契約書全文を自動生成。プレビュー表示後にGoogle Docsで開く', ''],
        ['REQ-CON04', '業務種別チップ選択', 'SNS運用・HP制作・HP運用保守・システム開発・AI導入支援・国産AI OEM提供・顧問契約・代理店契約から複数選択可', ''],
        ['REQ-CON05', '報酬形態切替', '月額固定/成果報酬/スポット選択で入力フィールドが動的変化', ''],
        ['REQ-CON06', '生成ルール', '生成書類は必ず社長に確認させ、送付は社長が行う（だいやによる直接送付を禁止）', '運用ルール'],
    ]))

    story.append(Sp(10))

    # 4.4 イベント運営管理
    story.append(H2('4.4 イベント運営管理'))
    story.append(P('講演・セミナー・自社説明会のイベント情報とチェックリストを管理する機能。2026年6月末の2イベントがデフォルト登録済み。', 'body'))

    story.append(colored_box('📌 デフォルト登録イベント:', AMBER_LIGHT))
    story.append(P('① 中小企業同友会 奥村航稀 講演　— 2026年6月28日（土）14:00 | 定員80名 | チェックリスト8項目', 'bullet'))
    story.append(P('② oku株式会社 自社サービス説明会 — 2026年6月30日（月）13:00 | 定員50名 | チェックリスト9項目', 'bullet'))
    story.append(Sp(8))

    story.append(req_table([
        ['REQ-SEM01', 'イベント一覧表示', 'イベント名・日時・会場・目標集客数・ターゲット・備考を表示', ''],
        ['REQ-SEM02', 'イベント新規追加', 'モーダルにてイベント名・日時・会場・定員・ターゲット・備考を登録', ''],
        ['REQ-SEM03', 'チェックリスト管理', '各イベントごとにチェックリスト項目を表示し、チェックボックスで完了管理', ''],
        ['REQ-SEM04', '進捗率自動計算', 'チェック済み項目数 / 全項目数 でパーセント計算し進捗バーに反映', 'ダッシュボードにも連動'],
        ['REQ-SEM05', 'ナビゲーションバッジ', '未完了イベント件数をサイドバーのバッジに表示', ''],
        ['REQ-SEM06', 'イベント削除', '不要なイベントを削除可能', ''],
    ]))

    story.append(Sp(8))
    story.append(H3('デフォルトチェックリスト内容'))
    chk_data = [
        [P('中小企業同友会 講演（8項目）', 'table_hdr'), P('自社サービス説明会（9項目）', 'table_hdr')],
        [P('会場の確認・予約（日程・レイアウト・AV機器）', 'table_cell'), P('チラシ最終版の確認・印刷・データ配布', 'table_cell')],
        [P('社長の講演資料の最終確認（社長に依頼）', 'table_cell'), P('申込フォーム（自動応答・Zoom案内自動送付）の作成', 'table_cell')],
        [P('参加者への案内メール・LINE一斉送付', 'table_cell'), P('SNS告知スケジュール作成（LINE/IG/TikTok/YT）', 'table_cell')],
        [P('リード回収用 LINE公式アカウントQRコード準備', 'table_cell'), P('ディレクター15人への集客タスク割り振り', 'table_cell')],
        [P('当日の名刺・チラシ・oku説明資料の印刷', 'table_cell'), P('会場手配・設営確認', 'table_cell')],
        [P('「本日の窓口はだいや」動線の設計', 'table_cell'), P('当日の受付担当・運営体制の確定', 'table_cell')],
        [P('終了後フォロー連絡テンプレートの作成', 'table_cell'), P('参加者リード管理スプレッドシートの準備', 'table_cell')],
        [P('当日運営スタッフの確定', 'table_cell'), P('終了後フォロー連絡テンプレートの作成', 'table_cell')],
        [P('', 'table_cell'), P('リード回収用LINE QRコード準備', 'table_cell')],
    ]
    ct = Table(chk_data, colWidths=[82*mm, 83*mm])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TEXT_DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(ct)

    story.append(PageBreak())

    # 4.5 クライアント管理
    story.append(H2('4.5 クライアント管理'))
    story.append(P('取引先・見込み客の情報、案件内容、対応状況を一元管理する機能。', 'body'))
    story.append(req_table([
        ['REQ-CLI01', 'クライアント一覧表示', '企業名・担当者・業種・案件種別・金額・ステータス・ヒアリング記録を表示', ''],
        ['REQ-CLI02', '新規クライアント登録', '企業名・担当者名・電話番号・メール・業種・案件種別・案件金額・ステータス・ヒアリング記録を入力', ''],
        ['REQ-CLI03', '業種選択', 'IT・システム開発 / SNS・Webマーケティング / 士業 / 飲食 / 宿泊・観光 / スポーツ施設 / 一次産業 / 製造業 / 小売・EC / 医療・介護 / 建設・不動産 / 教育 / その他', ''],
        ['REQ-CLI04', '案件種別選択', 'システム開発 / Web開発 / SNS運用 / AI導入 / AI OEM提供 / 顧問契約 / 代理店契約 / その他', ''],
        ['REQ-CLI05', 'ステータス管理', 'リード / 商談中 / 契約済 / 納品中 / 完了 / 保留 の6段階', ''],
        ['REQ-CLI06', 'クライアント編集', '登録済み情報の編集が可能', ''],
        ['REQ-CLI07', 'クライアント削除', '不要なクライアント情報の削除', ''],
        ['REQ-CLI08', 'アクティブ案件集計', '商談中・契約済・納品中の件数をダッシュボードKPIに反映', ''],
    ]))

    story.append(Sp(10))

    # 4.6 フォローアップ管理
    story.append(H2('4.6 フォローアップ管理'))
    story.append(P('イベント・SNS等で獲得したリードを商談化するためのアクション管理機能。', 'body'))
    story.append(req_table([
        ['REQ-FU01', 'リード一覧表示', '企業名・担当者・優先度・次アクション・期限・接触経路を表示', ''],
        ['REQ-FU02', 'リード新規登録', '企業名・担当者名・接触経路・連絡先・業種・優先度・課題メモ・次アクション・期限を入力', ''],
        ['REQ-FU03', '接触経路選択', '中小企業同友会講演 / oku自社説明会 / SNS経由 / 紹介 / その他', ''],
        ['REQ-FU04', '優先度管理', '高（すぐ連絡）/ 中（1週間以内）/ 低（今月中）の3段階', ''],
        ['REQ-FU05', '次アクション選択', 'LINE追加・挨拶 / 電話でヒアリング / 個別商談設定 / 資料送付 / 見積書送付 / 契約書作成', ''],
        ['REQ-FU06', '完了管理', 'フォローアップ完了のマーキング・除外', ''],
        ['REQ-FU07', 'ナビゲーションバッジ', '未完了フォローアップ件数をサイドバーバッジに表示', ''],
        ['REQ-FU08', 'ダッシュボード連動', 'フォロー待ち件数をダッシュボードKPIに反映', ''],
    ]))

    story.append(PageBreak())

    # 4.7 SNS管理
    story.append(H2('4.7 SNS管理'))
    story.append(P('LINE・Instagram・TikTok・YouTubeの4媒体にわたる投稿スケジュールをカテゴリ別に管理する機能。', 'body'))

    story.append(H3('プラットフォームと投稿カテゴリ'))
    cat_data = [
        [P('プラットフォーム', 'table_hdr'), P('カテゴリ名', 'table_hdr'), P('説明', 'table_hdr')],
        [P('LINE / Instagram\nTikTok / YouTube', 'table_cell'),
         P('訴求回（appeal）', 'table_cell'), P('直接CTA。フォロワーに申込・問合せを促すコンテンツ', 'table_cell')],
        [P('', 'table_cell'), P('認知LP（lp）', 'table_cell'), P('ランディング訴求。新規認知→LP誘導を目的としたコンテンツ', 'table_cell')],
        [P('', 'table_cell'), P('ルーク（lure）', 'table_cell'), P('興味・フック。視聴者の興味を引きつける入口コンテンツ', 'table_cell')],
        [P('', 'table_cell'), P('教育資産（edu）', 'table_cell'), P('中長期コンテンツ。知識提供による信頼構築・検索流入獲得', 'table_cell')],
    ]
    ct2 = Table(cat_data, colWidths=[35*mm, 35*mm, 95*mm])
    ct2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TEAL),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, TEAL_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('SPAN', (0,1), (0,4)),
    ]))
    story.append(ct2)
    story.append(Sp(8))
    story.append(req_table([
        ['REQ-SNS01', '媒体別件数表示', '各プラットフォームの登録投稿数をカード形式で表示', ''],
        ['REQ-SNS02', '投稿一覧表示', '投稿タイトル・プラットフォーム・カテゴリ・ステータス・日時・担当ディレクターを表示', ''],
        ['REQ-SNS03', '投稿新規登録', 'プラットフォーム・カテゴリ・ステータス・投稿日時・タイトル・担当者・メモを入力', ''],
        ['REQ-SNS04', 'ステータス管理', '予約済 / 下書き / 投稿済 の3段階', ''],
        ['REQ-SNS05', 'プラットフォームフィルター', 'プラットフォームボタンでフィルタリング（再クリックで解除）', ''],
        ['REQ-SNS06', '日付ソート', '投稿一覧を日付昇順で表示', ''],
        ['REQ-SNS07', '投稿削除', '不要な投稿の削除', ''],
    ]))

    story.append(Sp(10))

    # 4.8 スケジュール管理
    story.append(H2('4.8 スケジュール管理'))
    story.append(P('社長の商談・講演・社内MTGなどの予定をカレンダー形式で管理する機能。', 'body'))
    story.append(req_table([
        ['REQ-SCH01', 'カレンダー表示', '月間カレンダーを7列グリッドで表示。予定のある日にドット表示', ''],
        ['REQ-SCH02', '月切替', '前月・翌月への移動が可能', ''],
        ['REQ-SCH03', '予定新規追加', 'タイトル・日付・時間・種別・メモを入力', ''],
        ['REQ-SCH04', '予定種別', '商談 / 講演・セミナー / 社内MTG / 訪問 / 移動 / 締め切り / その他', ''],
        ['REQ-SCH05', '今月の予定一覧', 'カレンダー右側に当月の予定を日付昇順でリスト表示', ''],
        ['REQ-SCH06', '今日ハイライト', '当日の日付をアクセントカラーで強調表示', ''],
        ['REQ-SCH07', '予定削除', '不要な予定の削除', ''],
        ['REQ-SCH08', 'ダッシュボード連動', '次イベントまでの日数・直近タスクをダッシュボードに反映', ''],
    ]))

    story.append(PageBreak())

    # 4.9 財務ダッシュボード
    story.append(H2('4.9 財務ダッシュボード'))
    story.append(P('月次売上データを手動入力し、KPIと前月比トレンドを可視化する機能。', 'body'))
    story.append(req_table([
        ['REQ-FIN01', 'KPI表示（固定）', '年間売上¥30.0億・経常利益¥18.0億（60%）・月次売上平均¥2.5億・案件単価平均¥30万+ を表示', ''],
        ['REQ-FIN02', '月次売上入力', '月を選択し売上金額（万円）を手動入力', ''],
        ['REQ-FIN03', '前月比計算', '前月比の増減率をパーセントで自動計算・色分け表示（増加:緑 / 減少:赤）', ''],
        ['REQ-FIN04', '月次データ一覧', '入力済みデータを月・売上・前月比・削除の表形式で表示', ''],
        ['REQ-FIN05', 'エントリー削除', '不要なデータの削除', ''],
        ['REQ-FIN06', '未入金アラート', '書類生成履歴から未確認請求書のアラートを表示（将来実装）', '将来'],
    ]))

    story.append(PageBreak())

    # ── 5. データ管理 ─────────────────────────────────────────────────────
    story.append(H1('5. データ管理・状態保持'))
    story.append(HR())
    story.append(P('本システムは外部データベースを持たず、ブラウザのlocalStorageを利用してデータを永続化します。', 'body'))

    data_rows = [
        [P('データ種別', 'table_hdr'), P('キー名', 'table_hdr'), P('保持内容', 'table_hdr'), P('初期値', 'table_hdr')],
        [P('クライアント', 'table_cell'), P('S.clients', 'table_cell'), P('企業情報・案件情報の配列', 'table_cell'), P('空配列', 'table_cell')],
        [P('イベント（セミナー）', 'table_cell'), P('S.seminars', 'table_cell'), P('イベント情報・チェックリストの配列', 'table_cell'), P('2件デフォルト登録', 'table_cell')],
        [P('スケジュール', 'table_cell'), P('S.events', 'table_cell'), P('予定情報の配列', 'table_cell'), P('空配列', 'table_cell')],
        [P('財務データ', 'table_cell'), P('S.finEntries', 'table_cell'), P('月次売上エントリーの配列', 'table_cell'), P('空配列', 'table_cell')],
        [P('フォローアップ', 'table_cell'), P('S.followups', 'table_cell'), P('リード・フォローアップ情報の配列', 'table_cell'), P('空配列', 'table_cell')],
        [P('SNS投稿', 'table_cell'), P('S.snsPosts', 'table_cell'), P('SNS投稿スケジュールの配列', 'table_cell'), P('空配列', 'table_cell')],
    ]
    dt = Table(data_rows, colWidths=[35*mm, 30*mm, 70*mm, 30*mm])
    dt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TEXT_DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(dt)
    story.append(Sp(8))
    story.append(colored_box('⚠️ データはlocalStorageに保存されるため、ブラウザのデータクリア・プライベートモードではデータが失われます。定期的なエクスポートまたはバックアップを推奨します。', CORAL_LIGHT))

    # ── 6. 非機能要件 ─────────────────────────────────────────────────────
    story.append(H1('6. 非機能要件'))
    story.append(HR())
    story.append(req_table([
        ['NFR-01', 'レスポンシブ対応', 'デスクトップ（1080px以上）での使用を主とする。モバイルは参照・確認用', ''],
        ['NFR-02', '日本語対応', '全UIテキスト・ラベル・エラーメッセージを日本語で表示', ''],
        ['NFR-03', 'オフライン動作', 'localStorageを使用するため、インターネット接続なしでも主要機能が動作', 'Google Docs出力を除く'],
        ['NFR-04', 'トースト通知', '登録成功・エラーなどの操作結果を画面右下にトースト通知で表示', ''],
        ['NFR-05', 'ページ遷移', 'SPA（シングルページ）のため画面リロードなしでページ切替', ''],
        ['NFR-06', 'アクセシビリティ', 'フォーカス管理・キーボード操作の基本対応', ''],
        ['NFR-07', 'フォントレンダリング', 'Noto Sans JP / DM Monoを使用。日本語文字の可読性を確保', ''],
        ['NFR-08', 'セキュリティ', '認証機能なし（社内利用想定）。外部への自動送信機能なし', ''],
    ]))

    # ── 7. 画面構成 ─────────────────────────────────────────────────────
    story.append(H1('7. 画面構成・ナビゲーション'))
    story.append(HR())
    story.append(P('画面は左サイドバー（ナビゲーション）+ 右メインエリアの2カラム構成です。', 'body'))

    nav_rows = [
        [P('セクション', 'table_hdr'), P('メニュー項目', 'table_hdr'), P('ページID', 'table_hdr'), P('バッジ', 'table_hdr')],
        [P('メイン', 'table_cell'), P('ダッシュボード', 'table_cell'), P('dashboard', 'table_cell'), P('—', 'table_cell')],
        [P('★ 優先機能', 'table_cell'), P('書類スピード生成', 'table_cell'), P('docs', 'table_cell'), P('—', 'table_cell')],
        [P('', 'table_cell'), P('契約書ウィザード', 'table_cell'), P('contract', 'table_cell'), P('—', 'table_cell')],
        [P('', 'table_cell'), P('イベント運営管理', 'table_cell'), P('seminar', 'table_cell'), P('未完了イベント数', 'table_cell')],
        [P('クライアント', 'table_cell'), P('クライアント管理', 'table_cell'), P('clients', 'table_cell'), P('—', 'table_cell')],
        [P('', 'table_cell'), P('フォローアップ', 'table_cell'), P('followup', 'table_cell'), P('未完了数（非ゼロ時）', 'table_cell')],
        [P('運用', 'table_cell'), P('SNS管理', 'table_cell'), P('sns', 'table_cell'), P('—', 'table_cell')],
        [P('', 'table_cell'), P('スケジュール', 'table_cell'), P('schedule', 'table_cell'), P('—', 'table_cell')],
        [P('', 'table_cell'), P('財務ダッシュボード', 'table_cell'), P('finance', 'table_cell'), P('—', 'table_cell')],
    ]
    nt = Table(nav_rows, colWidths=[30*mm, 45*mm, 35*mm, 55*mm])
    nt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), ACCENT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, ACCENT_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(nt)

    # ── 8. 用語集 ─────────────────────────────────────────────────────
    story.append(H1('8. 用語集'))
    story.append(HR())
    term_rows = [
        [P('用語', 'table_hdr'), P('説明', 'table_hdr')],
        [P('だいや', 'table_cell'), P('社長サポート責任者。本システムの主要ユーザー', 'table_cell')],
        [P('リード', 'table_cell'), P('見込み客。イベントやSNSで接触した潜在顧客', 'table_cell')],
        [P('訴求回（appeal）', 'table_cell'), P('直接的な行動喚起（CTA）を目的としたSNSコンテンツカテゴリ', 'table_cell')],
        [P('認知LP（lp）', 'table_cell'), P('ランディングページへの誘導を目的としたSNSコンテンツカテゴリ', 'table_cell')],
        [P('ルーク（lure）', 'table_cell'), P('興味・フックを目的としたSNSコンテンツカテゴリ', 'table_cell')],
        [P('教育資産（edu）', 'table_cell'), P('中長期的な信頼構築・検索流入を目的としたSNSコンテンツカテゴリ', 'table_cell')],
        [P('国産AI OEM', 'table_cell'), P('oku株式会社が提供するAIサービスをホワイトラベルで他社に提供する形態', 'table_cell')],
        [P('localStorage', 'table_cell'), P('ブラウザに内蔵されたデータ保存機能。本システムのデータはここに保存される', 'table_cell')],
        [P('SPA', 'table_cell'), P('シングルページアプリケーション。1つのHTMLファイルで複数画面を切り替えるUI設計', 'table_cell')],
        [P('Google Docs出力', 'table_cell'), P('生成した書類内容をGoogle DocsのURLエンコード形式で新規ドキュメントとして開く機能', 'table_cell')],
    ]
    tt = Table(term_rows, colWidths=[40*mm, 125*mm])
    tt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TEXT_DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.4, GRAY_MID),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(tt)

    # Footer note
    story.append(Sp(20))
    story.append(HR(GRAY_MID))
    story.append(P('本要件定義書はoku株式会社 社長サポートシステム v3.0（oku_system_v3.html）のHTMLソースコードを解析し作成しました。', 'caption'))
    story.append(P('策定日: 2026年5月28日　　作成: Claude（Anthropic）　　機密区分: 社内限定', 'caption'))

    doc.build(story)
    print("PDF generated:", path)

build_pdf('/mnt/user-data/outputs/oku_system_v3_要件定義書.pdf')
