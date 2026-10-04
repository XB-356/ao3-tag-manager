/* AO3 标签管家 —— 界面汉化（普通脚本，挂在 globalThis.AO3TM.i18n）
   只翻译 AO3 自己的固定界面文案，绝不碰用户内容（正文、摘要、标签、用户名、评论）。 */
(function (root) {
  'use strict';

  const ATTR = 'data-ao3tm-i18n';

  /** 整段替换（按内容精确匹配，忽略大小写与首尾空白） */
  const PHRASES = {
    // —— 站点导航 ——
    'Fandoms': '同人圈',
    'Browse': '浏览',
    'Search': '搜索',
    'About': '关于',
    'FAQ': '常见问题',
    'News': '站内新闻',
    'Log In': '登录',
    'Log Out': '退出登录',
    'Sign Up': '注册',
    'Hi,': '你好，',
    'My Dashboard': '我的主页',
    'My Works': '我的作品',
    'My Bookmarks': '我的书签',
    'My Subscriptions': '我的订阅',
    'My History': '浏览历史',
    'My Preferences': '我的偏好',
    'Preferences': '偏好设置',
    'Post': '发布',
    'New Work': '新作品',
    'Import Work': '导入作品',
    'Import URL': '导入链接',
    'Collections': '合集',
    // —— 首页搜索区 ——
    'Work Search': '作品搜索',
    'People Search': '用户搜索',
    'Bookmark Search': '书签搜索',
    'Tag Search': '标签搜索',
    'Site Search': '站内搜索',
    'Find your favorites': '找到你的心头好',
    'Search Works': '搜索作品',
    'Search Tags': '搜索标签',
    'Search Bookmarks': '搜索书签',
    'Search People': '搜索用户',
    'Advanced Search': '高级搜索',
    'Search within results': '在结果中搜索',
    'Search in bookmarks': '在书签中搜索',
    'Search works': '搜索作品',
    // —— 作品列表 / 作品页 ——
    'Works': '作品',
    'Bookmarks': '书签',
    'Series': '系列',
    'Creator': '作者',
    'Creators': '作者',
    'Author': '作者',
    'Authors': '作者',
    'Chapters': '章节',
    'Chapter': '章节',
    'Words': '字数',
    'Hits': '点击',
    'Kudos': 'Kudos',
    'Comments': '评论',
    'Comment': '评论',
    '↑ Top': '↑ 回到顶部',
    // 注意：Top / Last / Or 都是多义词（Top 也是 AO3 的攻受标签；Last 是 Last visited 的片段），
    // 已在 EXACT_ONLY 名单里声明，只允许整段精确匹配，绝不参与片段替换。
    'My pseuds:': '我的笔名：',
    'I joined on:': '注册于：',
    'My user ID is:': '我的用户 ID：',
    // 浏览历史页：Last visited 的 Last 是"最近/末次"，不能按单词替换
    'Last visited:': '最近浏览：',
    'Last visited': '最近浏览',
    // —— 收件箱（Inbox）筛选与排序 ——
    'My Inbox': '我的收件箱',
    'Filter by read': '按已读状态筛选',
    'Filter by replied to': '按是否回复筛选',
    'Show without replies': '显示未回复的',
    'Show replied to': '显示已回复的',
    'Show unread': '显示未读',
    'Show read': '显示已读',
    'Sort by date': '按日期排序',
    'Newest first': '最新在前',
    'Oldest first': '最早在前',
    'unread': '未读',
    'Mark as read': '标记为已读',
    'Mark as unread': '标记为未读',
    // —— 挑战任务（Challenge Assignments）——
    'My Assignments': '我的任务',
    'Unposted Assignments': '未发布的任务',
    'My Claims': '我的领取',
    'Looking for prompts you claimed in a prompt meme? Try': '在找你在点梗活动里领取的题目？试试',
    'Unfulfilled Claims': '未完成的领取',
    'Fulfilled Claims': '已完成的领取',
    'Looking for assignments you were given for a gift exchange? Try': '在找礼物交换分配给你的任务？试试',
    // —— 统计页说明 ——
    'You currently have no works posted to the Archive. If you add some, you\'ll find information on this page about hits, kudos, comments, and bookmarks of your works.': '你目前还没有在 AO3 上发布任何作品。发布之后，这一页会显示你作品的点击、Kudos、评论与书签数据。',
    'Users can also see how many subscribers they have, but not the names of their subscribers or identifying information about other users who have viewed or downloaded their works.': '你还能看到自己的订阅者数量，但看不到订阅者是谁，也看不到浏览或下载过你作品的其他用户的身份信息。',
    'Statistics': '统计',
    // —— 领取页 / 挑战报名 ——
    'Close Offers ↑': '收起提供项 ↑',
    'Close Requests ↑': '收起需求项 ↑',
    'CSV Downloads': 'CSV 下载',
    'Sign-up': '报名',
    'Download (CSV)': '下载（CSV）',
    'Search by Pseud': '按笔名搜索',
    'No sign-ups yet!': '还没有人报名！',
    'Offers ↓': '提供项 ↓',
    'Requests ↓': '需求项 ↓',
    // —— 合集内容审核 ——
    'Add': '添加',
    'Add Bookmark to collections': '把书签加入合集',
    'Invite': '邀请',
    'Approved': '已通过',
    'Rejected by Collection': '被合集拒绝',
    'Rejected by User': '被用户拒绝',
    'Awaiting Collection Approval': '等待合集审核',
    'Awaiting User Approval': '等待用户通过',
    'Nothing to review here!': '这里没有待审核的内容！',
    // —— 站点地图 ——
    'Access your account': '访问你的账号',
    'My Collections and Challenges': '我的合集与挑战',
    'My Home': '我的主页',
    'My Series': '我的系列',
    'My Profile': '我的资料',
    'Change your account settings': '修改账号设置',
    'Explore': '探索',
    'Homepage': '首页',
    'Recent Works': '最新作品',
    'Additional Tags Cloud': '附加标签云',
    'Collections and Challenges': '合集与挑战',
    'This will permanently delete your account and cannot be undone. Are you sure?': '这会永久删除你的账号且无法撤销。确定吗？',
    // —— 评论相关补充 ——
    'Sorry, you have been blocked by one or more of this work\'s creators.': '抱歉，你已被这篇作品的一位或多位创作者屏蔽。',
    'Sorry, the Archive doesn\'t allow guests to comment right now.': '抱歉，AO3 目前不允许访客评论。',
    'Sorry, this work doesn\'t allow non-Archive users to comment.': '抱歉，这篇作品不允许非注册用户评论。',
    'Sorry, you can\'t add or edit comments on a hidden work.': '抱歉，隐藏的作品不能添加或编辑评论。',
    'Sorry, you can\'t add or edit comments on an unrevealed work.': '抱歉，未公开的作品不能添加或编辑评论。',
    'Sorry, this news post doesn\'t allow comments.': '抱歉，这条新闻不允许评论。',
    'Keep current comment settings': '保持当前评论设置',
    // —— 邀请码（Invitations）——
    'Copy and use': '复制并使用',
    'Copy link': '复制链接',
    'Copy Link': '复制链接',
    'Created at': '创建于',
    'Deleted User': '已删除用户',
    'Enter an email address': '输入邮箱地址',
    'Invitation token': '邀请码',
    'Last resent at': '上次重发于',
    'queue': '排队中',
    'Redeemed at': '兑换于',
    'Redeemed by': '兑换者',
    'Sender': '发送者',
    'Sent at': '发送于',
    'Sent to': '发送给',
    'Sent To': '发送给',
    'External Author': '站外作者',
    'Invitation Information': '邀请码信息',
    'Are you sure you want to delete this invitation?': '确定删除这个邀请码吗？',
    'List of your invitation tokens and information regarding who you shared them with, along with the option to share unused tokens.': '这里列出你的邀请码、你把它分享给了谁，也可以分享尚未使用的邀请码。',
    // —— 笔名编辑（Pseuds form）——
    'Description': '简介',
    'Icon': '头像',
    'Icon alt text': '头像替代文字',
    'Icon comment text': '头像注释文字',
    'change your username': '修改用户名',
    'Delete your icon and revert to our default. This will also remove your icon alt text and comment text.': '删除头像并恢复默认。这也会一并清除头像的替代文字与注释文字。',
    'This is your icon.': '这是你的头像。',
    // —— 礼物（Gifts）——
    'Accepted Gifts': '已接收的礼物',
    'Refused Gifts': '已拒绝的礼物',
    'Gifts for': '礼物收件人',
    // —— 任务（Assignments）——
    'Completed Assignments': '已完成的任务',
    'Fulfilled Assignments': '已完成的任务',
    'Posted Assignments': '已发布的任务',
    // —— 合集列表与筛选 ——
    'Date Created': '创建日期',
    'Date Updated': '更新日期',
    '(Closed, Unmoderated, Unrevealed, Anonymous)': '（已关闭、无需审核、未公开、匿名）',
    'Unmoderated': '无需审核',
    'Unrevealed': '未公开',
    'Anonymous': '匿名',
    'Bookmarked Items': '收录的书签',
    // —— 搜索表单（作品 / 用户 / 书签）——
    'Search all fields': '搜索所有字段',
    'Work Info': '作品信息',
    'Work Stats': '作品统计',
    'Work Tags': '作品标签',
    'Completion status': '完成状态',
    'All works': '全部作品',
    'Complete works only': '仅完结作品',
    'Works in progress only': '仅连载中作品',
    'Crossovers': '跨界联动',
    'Include crossovers': '包含跨界联动',
    'Exclude crossovers': '排除跨界联动',
    'Only crossovers': '仅跨界联动',
    'Word Count': '字数',
    'Work language': '作品语言',
    'Any field on work': '作品任意字段',
    'Any field on bookmark': '书签任意字段',
    'Work tags': '作品标签',
    'Bookmarker\'s tags': '收藏者的标签',
    'Bookmarker': '收藏者',
    'Type': '类型',
    'With notes': '含注释',
    'Date Bookmarked': '收藏日期',
    'Rec': '推荐',
    'Sort by': '排序方式',
    'Sort direction': '排序方向',
    'Best Match': '最佳匹配',
    'Descending': '降序',
    'Ascending': '升序',
    'Search people': '搜索用户',
    'Search bookmarks': '搜索书签',
    // —— 发布页 / 书签页 / 媒体页 ——
    'Post to Collections / Challenges': '发布到合集 / 挑战',
    'Recent Bookmarks': '最近的书签',
    'Latest Bookmarks': '最新书签',
    'These are some of the latest bookmarks created on the Archive. To find more bookmarks,': '这些是 AO3 上最近创建的一些书签。想找更多书签，',
    'try our advanced search.': '试试高级搜索。',
    'choose a fandom': '选择同人圈',
    'You can search this page by pressing': '你可以按',
    'and typing in what you are looking for.': '然后输入你要找的内容来搜索本页。',
    'Post to Collections': '发布到合集',
    'Collections / Challenges': '合集 / 挑战',
    // —— 搜索用户页 ——
    'Name': '名称',
    'Start typing for suggestions!': '开始输入以获得建议！',
    'Start typing for suggestions': '开始输入以获得建议',
    // 搜索框下的语法提示标签（官方 locale: works.search_box.tooltip_label = 'tip:'）。
    // 后面跟的是"示例查询"（如 "arthur merlin words>1000 sort:hits"）——
    // 那是可照抄的语法，必须保持原样，只翻前面的标签。
    'tip:': '提示：',
    // —— 各页页头引导语（官方 locale 的 about / notes_html 段，带链接，按实例收词）——
    'These are some random tags used on the Archive. To find more tags,': '这些是 AO3 上随机选取的一些标签。想找更多标签，',
    'try our tag search.': '试试标签搜索。',
    'These are some of the most popular tags used on the Archive. To find more tags,': '这些是 AO3 上最常用的一些标签。想找更多标签，',
    'These are some of the most popular tags used in the collection.': '这些是该合集里最常用的一些标签。',
    'These are some random tags used in the collection.': '这些是该合集里随机选取的一些标签。',
    'These are some of the latest works posted to the Archive. To find more works,': '这些是 AO3 上最近发布的一些作品。想找更多作品，',
    'Is it later already?': '已经是稍后了吗？',
    'Some works you\'ve marked for later.': '你标记为稍后阅读的一些作品。',
    'Search and Browse FAQ': '搜索与浏览常见问题',
    'You can have one icon for each pseud.': '每个笔名可以设置一个头像。',
    // —— 修掉"片段替换"残留（整短语收词条，避免半英半中）——
    'AO3 Terms of Service': 'AO3 服务条款',
    'Delete External Work': '删除站外作品',
    'Edit External Work': '编辑站外作品',
    'Hide External Work': '隐藏站外作品',
    'Make External Work Visible': '让站外作品可见',
    'Manage Archive FAQs': '管理 AO3 常见问题',
    'Relationships help': '配对说明',
    'Relationships Tags': '配对标签',
    'Relationships, pairings, orientations': '配对、CP、性向',
    'My Imported Works': '我导入的作品',
    'Claiming Your Imported Works': '认领你导入的作品',
    'History and Mark for Later': '浏览历史与稍后阅读',
    'History and Mark for Later FAQ': '浏览历史与稍后阅读常见问题',
    'Subscriptions and Feeds FAQ': '订阅与订阅源常见问题',
    'Collections, Challenges and Gifts Preferences': '合集、挑战与礼物偏好',
    'Who can comment on this work?': '谁可以评论这篇作品？',
    'Graphic Depictions Of Violence': '暴力描写',
    'Graphic Depictions Of Violence:': '暴力描写：',
    'Some issues you can contact Support about include:': '可以联系支持团队的问题包括：',
    'Brief summary of Terms of Service violation (required)': '违反服务条款的简要说明（必填）',
    'Visited': '浏览过',
    // —— 浏览历史页 ——
    'Clear Entire History': '清空全部浏览历史',
    'Delete from History': '从浏览历史中删除',
    'List of History Items': '浏览历史列表',
    'History': '浏览历史',
    'Recent': '最近',
    '(Latest version.)': '（最新版本）',
    'Latest version': '最新版本',
    'Manage My Pseuds': '管理我的笔名',
    'Delete My Account': '删除我的账号',
    'characters left': '剩余字符',
    'Enter Comment': '输入评论',
    // —— 发布 / 编辑作品表单（来自官方 locale works.work_form_* 与真实页面）——
    'Import From An Existing URL Instead?': '改为从已有链接导入？',
    'Required information': '必填信息',
    '* Required information': '* 必填信息',
    'Work Title': '作品标题',
    'Work Title*': '作品标题*',
    'Rating': '分级',
    'Rating*': '分级*',
    'Archive Warnings': '站内警告',
    'Archive Warnings*': '站内警告*',
    'Fandoms*': '同人圈*',
    'at the beginning': '开头',
    'at the end': '结尾',
    'Gift this work to': '把这篇作品赠送给',
    'Gen': '一般向',
    'Multi': '多元',
    'Other': '其他',
    'URL': '链接',
    'Tags are comma separated, 150 characters per tag. Fandom, relationship, character, and additional tags are all added here.': '标签用英文逗号分隔，每个标签最多 150 字符。同人圈、配对、角色和附加标签都填在这里。',
    'If this is the first work for a fandom, it may not show up in the fandoms page for a day or two.': '如果这是某个同人圈的第一篇作品，它可能需要一两天才会出现在该同人圈页面。',
    'Warning: Unchecking this box will delete the existing beginning note.': '警告：取消勾选会删除已有的开头批注。',
    'Warning: Unchecking this box will delete the existing end note.': '警告：取消勾选会删除已有的结尾批注。',
    'Language': '语言',
    'Warnings': '警告',
    'Relationships': '配对',
    'Characters': '角色',
    'Additional Tags': '附加标签',
    'Stats': '统计',
    'Summary': '摘要',
    'Notes': '注释',
    'Collections:': '合集：',
    'Series:': '系列：',
    'Language:': '语言：',
    'Words:': '字数：',
    'Chapters:': '章节：',
    // —— 个人资料页 / 用户中心 ——
    // 长句：整句翻不了时由"内嵌短语替换"处理（只替换这些站点固定短语，见 translateInlinePhrases）
    'Hi! It looks like you\'ve just logged in to AO3 for the first time.': '你好！看起来这是你第一次登录 AO3。',
    'For help getting started on AO3, check out some useful tips for new users': '想上手 AO3，可以看看这些给新用户的实用提示',
    'or browse through our FAQs': '也可以翻翻常见问题',
    'For help getting started on AO3, check out some useful tips for new users or browse through our FAQs': '想上手 AO3，可以看看这些给新用户的实用提示，也可以翻翻常见问题',
    'If you experience harassment or have questions about our Terms of Service (including the Content Policy and Privacy Policy)': '如果你遭遇骚扰，或对服务条款（包括内容政策与隐私政策）有疑问',
    'If you need technical support, contact our Support team.': '如果你需要技术支持，请联系我们的支持团队。',
    'If you experience harassment or have questions about our Terms of Service': '如果你遭遇骚扰，或对服务条款有疑问',
    'including the Content Policy and Privacy Policy': '包括内容政策与隐私政策',
    ')。': '）。',
    '(including the Content Policy and Privacy Policy)': '（包括内容政策与隐私政策）',
    'contact our Policy & Abuse team.': '请联系我们的政策与滥用处理团队。',
    'You don\'t have anything posted under this name yet.': '你还没有以这个笔名发布过任何作品。',
    'Would you like to publish a new work or maybe a new bookmark?': '要发布新作品，还是添加新书签？',
    // 这些会被 AO3 拆成"链接 + 文本"多个节点，必须整段进词典，
    // 否则按片段替换会得到"关于 the Archive"这种中英夹杂
    'For help getting started on AO3': '想上手 AO3',
    'check out some useful tips for new users': '可以看看这些给新用户的实用提示',
    'useful tips for new users': '给新用户的实用提示',
    // AO3 把这些句子用 <a> 链接切成了多个文本节点，
    // 整句 key 匹配不上任何一个节点，所以必须按"节点边界片段"逐条收录
    'check out some': '看看这些',
    '想上手 AO3, check out some': '想上手 AO3，看看这些',
    'or browse through': '也可以翻翻',
    'our FAQs': '常见问题',
    'If you experience harassment or have questions about our': '如果你遭遇骚扰，或对',
    'Terms of Service (including the': '服务条款（包括',
    // 连接词 and 只作整段匹配，译文用「与」；
    // 不要用顿号：说明性文字（"character, and additional tags"）会被破坏
    'and': '与',
    'Content Policy and Privacy Policy': '内容政策与隐私政策',
    'contact our Policy & Abuse team': '请联系我们的政策与滥用处理团队',
    'publish a new work': '发布新作品',
    'publish': '发布',
    'If you need technical support,': '如果你需要技术支持，',
    'contact our Support team': '联系我们的支持团队',
    'About the Archive': '关于本站',
    // 「About」会被单独替换成"关于"，于是 "About Us" 变成 "关于 Us"。
    // 凡是 About / All 开头的站点短语都必须有完整词条（原文取自官方 locale views/en.yml）。
    'About Us': '关于我们',
    'About AO3': '关于 AO3',
    'About the OTW': '关于 OTW',
    'About AO3 and the OTW': '关于 AO3 与 OTW',
    'Previous Post': '上一篇',
    'Next Post': '下一篇',
    'User Research': '用户研究',
    'About Me': '关于我',
    'About Two-Step Verification': '关于两步验证',
    'About the Archive of Our Own': '关于 AO3',
    'All Fandoms': '全部同人圈',
    '全部 Fandoms': '全部同人圈',
    'All Subscriptions': '全部订阅',
    'All approved public skins': '所有已通过的公开皮肤',
    // —— 站内新闻列表（AO3 News / admin_posts）——
    'AO3 News': 'AO3 站内新闻',
    // 常见问题页只翻"头顶引导语"：问答正文官方已有简中（language_id=zh-Hans），不碰
    'Some commonly asked questions about the Archive are answered here. Questions and answers about our Terms of Service can be found in the': '这里回答了关于本站的一些常见问题。服务条款相关的问答见',
    '. You may also like to check out our': '。你也可以看看我们的',
    '. If you need more help, please': '。如果需要更多帮助，请',
    // —— 关于我们（About AO3 and the OTW）：段落被链接切碎，按节点边界收录 ——
    'AO3 is built upon the principle of': 'AO3 建立在这样一个原则之上：',
    // 段落被 <strong>/<a> 切碎后，这些碎片是各自独立的文本节点，必须按节点收录
    'Fanworks that do not violate the': '只要不违反',
    '. Fanworks that do not violate the': '。只要不违反',
    'or some other part of the': '或服务条款其他部分的',
    'will not be removed from AO3, even if someone believes they are offensive or objectionable.': '作品不会被移出 AO3——即使有人认为它们冒犯或令人反感。',
    'developed by the Organization for Transformative Works (OTW). Anyone is welcome to': '由 OTW（再创作组织）开发。欢迎任何人',
    'by working on the unclaimed tasks in our': '，从我们的',
    'AO3\'s history on Fanlore': 'Fanlore 上的 AO3 历史',
    'maximum inclusiveness of fanwork content': '尽可能广泛地收录同人作品',
    'AO3 runs on': 'AO3 运行在',
    'open-source archiving software': '开源存档软件',
    'contribute': '参与贡献',
    'Jira project': 'Jira 项目',
    'Our Team': '我们的团队',
    'Known Issues': '已知问题',
    'Behind the scenes, AO3 is run by volunteers serving on': 'AO3 由志愿者在幕后运营，他们任职于',
    'committees': '各委员会',
    ', which collaborate to support AO3 in different ways:': '，从不同方面协作支持 AO3：',
    'Accessibility, Design, & Technology': '无障碍、设计与技术',
    'designs, maintains, and develops AO3\'s code.': '设计、维护并开发 AO3 的代码。',
    'AO3 Documentation': 'AO3 文档',
    'creates and maintains AO3\'s FAQs, help pop-ups, and tutorials.': '编写并维护 AO3 的常见问题、帮助弹窗与教程。',
    'Communications': '传播',
    // —— 关于我们：委员会与后续段落 ——
    'publishes news posts on AO3 and communicates with users about AO3-related updates.': '在 AO3 上发布新闻帖，并就 AO3 相关更新与用户沟通。',
    'Open Doors': 'Open Doors（开放之门）',
    'imports at-risk archives and fanzines to AO3.': '把濒危的存档与同人志导入 AO3。',
    'Policy & Abuse': '政策与滥用处理',
    'Support': '支持',
    'helps users resolve technical problems and passes on user feedback to other AO3 committees.': '帮助用户解决技术问题，并把用户反馈转达给 AO3 其他委员会。',
    'Systems': '系统',
    'manages the servers that AO3 runs on.': '管理 AO3 所运行的服务器。',
    'Tag Wrangling': '标签管理',
    'sorts and organizes tags on AO3, linking related tags together for better filtering and searching.': '整理并归置 AO3 上的标签，把相关标签关联起来，以便更好地筛选与搜索。',
    'Translation': '翻译',
    'helps committees communicate with users in non-English languages and translates news and information about AO3.': '协助各委员会用非英语语言与用户沟通，并翻译关于 AO3 的新闻与信息。',
    'User Response Translation': '用户回复翻译',
    'addresses Policy & Abuse and Support\'s translation needs in specific high-need languages.': '针对特定高需求语言，满足政策与滥用处理、支持团队的翻译需求。',
    'AO3 entered open beta in November 2009 and exited beta in April 2026. You can read more about': 'AO3 于 2009 年 11 月进入公开测试，2026 年 4 月结束测试。你可以在',
    'The OTW is a 501(c)(3) non-profit organization, fully supported by': 'OTW 是 501(c)(3) 非营利组织，完全依靠',
    'donations': '捐赠',
    'and run by and for fans. The': '运营，由同人爱好者创办、也为他们服务。',
    'OTW\'s mission': 'OTW 的使命',
    'is to preserve and protect': '是保存并保护',
    'transformative fanworks': '再创作同人作品',
    'and fan culture in their myriad forms. We believe that fanworks are transformative and that transformative works are legitimate.': '以及形态各异的同人文化。我们相信同人作品具有再创作性质，而再创作作品是正当的。',
    'Our other major projects include:': '我们的其他主要项目包括：',
    'Fanlore': 'Fanlore',
    ', a fandom wiki devoted to preserving the history of transformative fanworks and the fandoms from which they have arisen.': '，一个同人维基，致力于保存再创作同人作品及其所属同人圈的历史。',
    'Visit Fanlore.': '访问 Fanlore。',
    'Legal Advocacy': '法律倡导',
    'Visit Open Doors.': '访问 Open Doors。',
    'Transformative Works and Cultures': '《再创作作品与文化》',
    '(TWC), an international, peer-reviewed journal that publishes articles about transformative works and fan communities.': '（TWC），一份国际同行评审期刊，发表关于再创作作品与同人社群的文章。',
    'Visit TWC.': '访问 TWC。',
    'Learn More': '了解更多',
    'You can find information on using AO3 in the': '你可以在',
    'Archive FAQs': 'AO3 常见问题',
    ', or visit the': '里找到 AO3 的使用说明，或访问',
    'OTW FAQs': 'OTW 常见问题',
    'to learn more about our organization. If you want to get involved, you can': '了解更多关于本组织的信息。如果你想参与，可以',
    'For technical help using AO3, including bug reports and feature requests, please': '如需 AO3 使用上的技术支持（含问题反馈与功能建议），请',
    'contact Policy & Abuse': '联系政策与滥用处理团队',
    '. If you have any other questions, please': '。如有其他问题，请',
    // —— 关于我们：整段正文（之前漏收，因为以空格/小写开头，审计脚本没列出来）——
    'Archive of Our Own': 'AO3（Archive of Our Own）',
    '(AO3) is a non-profit, non-commercial fanwork archive for transformative fanworks; created by and for fans of books, music, art, games, shows, movies, real-person fiction (RPF), and other fandoms.': '（AO3）是一个非营利、非商业的同人作品存档站，收录再创作同人作品；它由同人爱好者创建，也为书籍、音乐、美术、游戏、剧集、电影、真人同人（RPF）及其他同人圈的爱好者服务。',
    'addresses questions and reports about potential violations of the AO3': '负责处理有关可能违反 AO3',
    'which is committed to protecting and defending fanworks from commercial exploitation and legal challenges. They also strive to educate fans about developments in law that could affect fandom.': '致力于保护并捍卫同人作品，使其免受商业剥削与法律挑战。他们也努力让同人爱好者了解可能影响同人圈的法律动向。',
    'which offers shelter to at-risk fannish projects and archives. Through several subprojects, they preserve different kinds of fanworks and artifacts of fan culture.': '为面临风险的同类项目与存档提供庇护。通过多个子项目，他们保存各种形式的同人作品与同人文化产物。',
    'For questions or reports about violations of the AO3': '如需就违反 AO3',
    'contact Communications': '联系传播团队',
    // —— 关于我们：整段整句翻译（碎片拼接会出现语病，用户反馈）——
    'AO3 is built upon the principle of maximum inclusiveness of fanwork content. Fanworks that do not violate the Content Policy or some other part of the Terms of Service will not be removed from AO3, even if someone believes they are offensive or objectionable.': 'AO3 建立在「尽可能广泛地收录同人作品」这一原则之上。只要不违反内容政策或服务条款的其他部分，作品就不会被移出 AO3——即使有人认为它们冒犯或令人反感。',
    'AO3 runs on open-source archiving software developed by the Organization for Transformative Works (OTW). Anyone is welcome to contribute by working on the unclaimed tasks in our Jira project.': 'AO3 运行在由 OTW（再创作组织）开发的开源存档软件之上。欢迎任何人参与贡献，从我们的 Jira 项目中认领任务即可。',
    'AO3 entered open beta in November 2009 and exited beta in April 2026. You can read more about AO3\'s history on Fanlore.': 'AO3 于 2009 年 11 月进入公开测试，2026 年 4 月结束测试。你可以在 Fanlore 上了解更多 AO3 的历史。',
    'Behind the scenes, AO3 is run by volunteers serving on committees, which collaborate to support AO3 in different ways:': 'AO3 由志愿者在幕后运营，他们任职于各委员会，从不同方面协作支持 AO3：',
    'The OTW is a 501(c)(3) non-profit organization, fully supported by donations and run by and for fans. The OTW\'s mission is to preserve and protect transformative fanworks and fan culture in their myriad forms. We believe that fanworks are transformative and that transformative works are legitimate.': 'OTW 是 501(c)(3) 非营利组织，完全依靠捐赠运营，由同人爱好者创办、也为他们服务。OTW 的使命是保存并保护形态各异的再创作同人作品与同人文化。我们相信同人作品具有再创作性质，而再创作作品是正当的。',
    'Tag:': '标签：',
    'Go': '筛选',
    'RSS Feed': 'RSS 订阅',
    'Credits': '鸣谢',
    'Details': '详情',
    'News Post': '新闻帖',
    'Read more': '阅读全文',
    // —— 合集 / 挑战（来自 collections.*）——
    'Bookmarked Items:': '收录的书签：',
    'Challenges/Subcollections:': '挑战 / 子合集：',
    'Collection Tags:': '合集标签：',
    'Prompts:': '题目：',
    'Sign-ups close at:': '报名截止：',
    'Either': '不限',
    'Closed': '已关闭',
    'Moderated': '需审核',
    'Multifandom': '多同人圈',
    'Filter collections:': '筛选合集：',
    'Filter by tag': '按标签筛选',
    'Filter by title': '按标题筛选',
    'Collection Type': '合集类型',
    'Gift Exchange Challenge': '礼物交换挑战',
    'Prompt Meme Challenge': '点梗挑战',
    'No Challenge': '非挑战',
    'Custom header URL': '自定义页头图片链接',
    'List of Collections': '合集列表',
    'Manage Collection Items': '管理合集内容',
    'New Collection': '新建合集',
    'New Subcollection': '新建子合集',
    'Open Challenges': '开放中的挑战',
    'Subcollections': '子合集',
    'Challenge Settings': '挑战设置',
    'Collection Settings': '合集设置',
    'Manage Items': '管理内容',
    'Parent Collection': '上级合集',
    'Random Items': '随机内容',
    'Rules': '规则',
    'PNG, JPEG, GIF': 'PNG、JPEG、GIF',
    'Contents': '目录',
    'Use this if your collection is not fandom-specific.': '如果你的合集不针对特定同人圈，请勾选此项。',
    'Delete collection icon and revert to our default. This will also remove the icon alt text and comment text.': '删除合集图标并恢复默认。这也会一并清除图标的替代文字与注释文字。',
    'Sorry, there were no collections found.': '抱歉，没有找到符合条件的合集。',
    // —— 标签页（来自 tags.*）——
    'try our tag search': '试试标签搜索',
    'these are some of the most popular tags used in the collection.': '这些是该合集里最常用的一些标签。',
    'Any status': '任意状态',
    'Canonical': '官方标签',
    'Canonical or synonymous': '官方标签或同义',
    'Non-canonical': '非官方标签',
    'Synonymous': '同义标签',
    'Unwrangleable': '无法归类',
    'Tag name': '标签名',
    'Wrangling status': '归类状态',
    'canonical tag': '官方标签',
    'and more': '以及更多',
    'Relationship tags in this fandom': '该同人圈里的配对标签',
    'filter bookmarks': '筛选书签',
    'filter works': '筛选作品',
    'Tags with the same meaning:': '同义标签：',
    'Find tags wrangled to specific canonical fandoms.': '查找已归入特定官方同人圈的标签。',
    // —— 屏蔽 / 静音用户（来自 blocked.* 与 muted.*）——
    'Block': '屏蔽',
    'Unblock': '解除屏蔽',
    'Blocked Users': '已屏蔽的用户',
    'Block a user': '屏蔽用户',
    'Yes, Block User': '是，屏蔽该用户',
    'Yes, Unblock User': '是，解除屏蔽',
    'You have not blocked any users.': '你还没有屏蔽任何用户。',
    'Blocking a user prevents them from:': '屏蔽某位用户后，TA 将无法：',
    'Blocking a user will not:': '屏蔽某位用户不会：',
    'commenting or leaving kudos on your works': '在你的作品下评论或点 Kudos',
    'replying to your comments anywhere on the site': '在站点任何位置回复你的评论',
    'hide their comments elsewhere on the site': '隐藏 TA 在站内其他位置的评论',
    'hide their works or bookmarks from you': '对你隐藏 TA 的作品或书签',
    'Unblocking a user allows them to resume:': '解除屏蔽后，该用户可以恢复：',
    'Mute': '静音',
    'Unmute': '取消静音',
    'Muted Users': '已静音的用户',
    'Mute a user': '静音用户',
    'Yes, Mute User': '是，静音该用户',
    'Yes, Unmute User': '是，取消静音',
    'You have not muted any users.': '你还没有静音任何用户。',
    'Muting a user:': '静音某位用户会：',
    'Muting a user will not:': '静音某位用户不会：',
    'Listing Muted Users': '已静音用户列表',
    'Listing Blocked Users': '已屏蔽用户列表',
    // —— 订阅（来自 subscriptions.*）——
    'List of Subscriptions': '订阅列表',
    'Series Subscriptions': '系列订阅',
    'User Subscriptions': '用户订阅',
    'Work Subscriptions': '作品订阅',
    'My Series Subscriptions': '我的系列订阅',
    'My User Subscriptions': '我的用户订阅',
    'My Work Subscriptions': '我的作品订阅',
    'Delete All Subscriptions': '删除全部订阅',
    'Delete All Work Subscriptions': '删除全部作品订阅',
    'Delete All Series Subscriptions': '删除全部系列订阅',
    'Delete All User Subscriptions': '删除全部用户订阅',
    'Yes, Delete All Subscriptions': '是，删除全部订阅',
    'Yes, Delete All Work Subscriptions': '是，删除全部作品订阅',
    '(Series)': '（系列）',
    '(Work)': '（作品）',
    'Site Map': '站点地图',
    'Diversity Statement': '多元声明',
    'Terms of Service': '服务条款',
    'Content Policy': '内容政策',
    'Privacy Policy': '隐私政策',
    'DMCA & TIDA Policies': 'DMCA 与 TIDA 政策',
    'Site Status': '站点状态',
    'Contact Us': '联系我们',
    'Policy Questions & Abuse Reports': '政策咨询与滥用举报',
    'Technical Support & Feedback': '技术支持与反馈',
    'Development': '开发',
    'Wrangling Guidelines': '标签管理员指南',
    'Donate or Volunteer': '捐赠或参与志愿',
    'Organization for Transformative Works': 'OTW（再创作组织）',
    'news outlets': '新闻渠道',
    'Main Content': '主要内容',
    'Footer': '页脚',
    'Customize': '自定义外观',
    // 站点皮肤名不翻（'Low Vision Default'、'Snow Blue' 等属于数据）
    'Switch': '切换',
    'Choices': '选项',
    'Pitch': '音高',
    'Catch': '接住',
    // —— 媒体分类（首页"浏览"区）——
    'Anime & Manga': '动画与漫画',
    'Books & Literature': '书籍与文学',
    'Cartoons & Comics & Graphic Novels': '卡通、漫画与图像小说',
    'Celebrities & Real People': '名人与真人',
    'Movies': '电影',
    'Music & Bands': '音乐与乐队',
    'Other Media': '其他媒体',
    'Theater': '戏剧',
    'TV Shows': '电视节目',
    'Video Games': '电子游戏',
    'Uncategorized Fandoms': '未分类同人圈',
    // —— 日期缩写（显示在"发表与…"后面）——
    'Jan': '1月',
    'Feb': '2月',
    'Mar': '3月',
    'Apr': '4月',
    'May': '5月',
    'Jun': '6月',
    'Jul': '7月',
    'Aug': '8月',
    'Sep': '9月',
    'Sept': '9月',
    'Oct': '10月',
    'Nov': '11月',
    'Dec': '12月',
    'Mon': '周一',
    'Tue': '周二',
    'Wed': '周三',
    'Thu': '周四',
    'Fri': '周五',
    'Sat': '周六',
    'Sun': '周日',
    'UTC': 'UTC',
    'Would you like to': '你想',
    'Organization for Transformative Works\' news outlets': 'OTW（再创作组织）的新闻渠道',
    // 上面那句在页面里被 <a> 链接切成两个文本节点，这里按节点边界各给一条，
    // 拼起来就是完整中文；否则链接后面的英文会原样留下
    'Follow AO3 on Bluesky or Tumblr for status updates, and don\'t forget to check out the': '关注 AO3 的 Bluesky 或 Tumblr 获取状态更新，也别忘了看看',
    'for updates on our other projects!': '，了解其他项目的进展！',
    'OTW': 'OTW',
    // —— 作品页 / 发布与编辑（来自 AO3 官方 locale: works.*）——
    'Associations': '关联作品',
    'This work could have adult content. If you continue, you have agreed that you are willing to see such content.': '这篇作品可能包含成人内容。继续访问即表示你同意查看此类内容。',
    'No, Go Back': '不，返回',
    'Yes, Continue': '是的，继续',
    'Set your preferences now': '现在就去修改偏好',
    'Work in Progress': '连载中',
    'Completed Work': '已完结',
    'Complete Work': '已完结',
    'If you accept cookies from our site and you choose "Yes, Continue", you will not be asked again during this session (that is, until you close your browser). If you log in you can store your preference and never be asked again.': '如果你接受本站的 Cookie 并选择「是的，继续」，本次会话期间将不再询问（即直到你关闭浏览器）。登录后可以保存此偏好，之后就不再询问。',
    'Adult Content Warning': '成人内容警告',
    'Add co-creators': '添加共同作者',
    'Add co-creators?': '要添加共同作者吗？',
    'Unposted Draft': '未发布的草稿',
    'Please note:': '请注意：',
    'Are you sure you want to delete this work? This will destroy all comments and kudos on this work as well and CANNOT BE UNDONE!': '确定删除这篇作品吗？这会同时销毁它下面的所有评论与 Kudos，且无法撤销！',
    'Edit Chapter:': '编辑章节：',
    'Manage Chapters': '管理章节',
    'Orphan Work': '遗弃作品',
    'Remove Me As Co-Creator': '把我从共同作者中移除',
    'Comments moderated': '评论需审核',
    'Registered users': '仅注册用户',
    'Work skins': '作品皮肤',
    'Imported Works': '导入的作品',
    'We were able to successfully upload the following works.': '以下作品已成功上传。',
    'Original Creator ID:': '原作者 ID：',
    'Original Creator IDs:': '原作者 ID：',
    'Only show imported works to registered users': '导入的作品仅对注册用户可见',
    'Keep current visibility settings': '保持当前可见性设置',
    'Visibility': '可见性',
    'Only show to registered users': '仅对注册用户可见',
    'Only show your work to registered users': '你的作品仅对注册用户可见',
    'Show to all': '所有人可见',
    'Post Work': '发布作品',
    'Preview Tags': '预览标签',
    'Preview Tags and Language': '预览标签与语言',
    'You have no works or drafts to edit.': '你还没有可编辑的作品或草稿。',
    'Select work skin': '选择作品皮肤',
    'Deleted work': '已删除的作品',
    'This work is a remix, a translation, a podfic, or was inspired by another work': '这篇作品是改编、翻译、有声书，或受其他作品启发',
    'Remove': '移除',
    'Are you sure you want to remove the connection to this work?': '确定解除与这篇作品的关联吗？',
    'Mystery Work': '神秘作品',
    'Chapter Index': '章节目录',
    'Full-Page Index': '整页目录',
    'Other works inspired by this one': '受这篇启发的其他作品',
    // —— 账号 / 登录 / 注册（来自 users.*）——
    'Confirm New Email': '确认新邮箱',
    'Current email': '当前邮箱',
    'Enter new email again': '再次输入新邮箱',
    'New email': '新邮箱',
    'Old password': '原密码',
    'Account FAQ': '账号常见问题',
    'Please use this feature with caution.': '请谨慎使用此功能。',
    'You can change your username once per day.': '用户名每 24 小时只能修改一次。',
    'Are you sure you want to change your username?': '确定要修改用户名吗？',
    'Current username': '当前用户名',
    'New username': '新用户名',
    'Yes, Change Email': '是，修改邮箱',
    'Return to Archive front page': '返回 AO3 首页',
    'Almost Done!': '快好了！',
    'What do you want to do with your works?': '你想如何处理你的作品？',
    'Delete completely': '彻底删除',
    'Reset Password': '重置密码',
    'Create Account': '创建账号',
    'Legal Agreements': '法律协议',
    'User Details': '用户信息',
    'Confirm password': '确认密码',
    'Please enter the same password in both fields.': '请在两个字段里输入相同的密码。',
    'Valid email': '有效邮箱',
    'My Collections': '我的合集',
    'My Sign-ups': '我的报名',
    'Create an account now': '立即创建账号',
    'Request an invitation to join': '申请邀请码',
    'Reset your password': '重置你的密码',
    'Sorry!': '抱歉！',
    'Password:': '密码：',
    'Username or email:': '用户名或邮箱：',
    'Create an Account': '创建账号',
    'Get an Invitation': '获取邀请码',
    'Hide first login help banner': '隐藏首次登录帮助提示',
    'Pseud Switcher': '笔名切换',
    'Leave my pseud but attach to the orphan account': '保留笔名，但归属到 orphan 账号',
    'Remove me completely as co-creator': '把我从共同作者中完全移除',
    // —— 评论（来自 comments.*）——
    'Approve': '通过',
    'Comment Actions': '评论操作',
    'Parent Thread': '父级评论串',
    'Reply to this comment': '回复这条评论',
    'Anonymous Creator': '匿名创作者',
    'Choose Name': '选择署名',
    'Comment as': '评论身份',
    'Guest email (required)': '访客邮箱（必填）',
    'Please enter your email address.': '请输入你的邮箱地址。',
    'Please enter your name.': '请输入你的名字。',
    'Guest name (required)': '访客名字（必填）',
    'Add to Collections': '加入合集',
    'Invite To Collections': '邀请加入合集',
    'contact Support': '联系支持团队',
    'Disable comment moderation': '关闭评论审核',
    'Enable comment moderation': '开启评论审核',
    'Comment moderation': '评论审核',
    // —— 作品页 / 评论表单（来自真实页面，官方 locale 里多为插值模板）——
    // 注意：kudos 那行由 PATTERNS 的模式统一处理（数字是变量），
    // 这里**不要**再放固定数字的整段 key，否则会和模式叠加出重复文案。
    ', and ': '、',
    // —— 发布作品页（来自真实快照 New Work）——
    'Tags are comma separated, 150 characters per tag. Fandom, relationship, character, and additional tags must not add up to more than 75. Archive warning, category, and rating tags do not count toward this limit.': '标签用英文逗号分隔，每个标签最多 150 字符。同人圈、配对、角色与附加标签合计不得超过 75 个；站内警告、类别与分级标签不计入此上限。',
    'This work is part of a series': '这篇作品属于某个系列',
    'This work has multiple chapters': '这篇作品有多章',
    'Please select': '请选择',
    'Please select a language': '请选择语言',
    'Work Text': '作品正文',
    'Work Text*': '作品正文*',
    'Note:': '注意：',
    'Text entered in the posting form is': '发布表单里填写的内容',
    'automatically saved. Always keep a backup copy of your work.': '不会自动保存。请务必自行保留作品备份。',
    'not': '不会',
    'Rich Text': '富文本',
    'HTML': 'HTML',
    'Preview': '预览',
    'Chapter 1 of': '第 1 章，共',
    'Or create and use a new one:': '或新建并使用一个：',
    'Uncategorized Constructed Languages': '未分类的人造语言',
    // —— 导入作品页（Import New Work）——
    'Import New Work': '导入作品',
    'Please note! Fanfiction.net, Wattpad.com, and Quotev.com do not allow imports from their sites.': '请注意！Fanfiction.net、Wattpad.com 与 Quotev.com 不允许从其站点导入作品。',
    // 同一句在 and 被替换过的旧快照里可能是顿号形式，一并兼容
    'Please note! Fanfiction.net, Wattpad.com、Quotev.com do not allow imports from their sites.': '请注意！Fanfiction.net、Wattpad.com 与 Quotev.com 不允许从其站点导入作品。',
    'You might find the': '你可以参考',
    'Import FAQ': '导入常见问题',
    'useful.': '。',
    'Works URLs': '作品链接',
    'URLs': '链接',
    'URLs*': '链接*',
    'URLs for existing work(s) or for the chapters of a single work;': '已存在作品（或多章作品的各章节）的链接；',
    'one URL per line.': '每行一个链接。',
    'Set custom encoding': '设置自定义编码',
    'Choose a language*': '选择语言*',
    'Post New Work Instead?': '改为发布新作品？',
    'Import as': '导入为',
    'Works (limit of 25)': '作品（上限 25）',
    'Chapters in a single work (limit of 200)': '单篇作品的章节（上限 200）',
    'Post without previewing.': '发布前不预览。',
    'Override tags and notes': '覆盖标签与注释',
    'Set the following tags and/or notes on all works, overriding whatever the importer finds in the content.': '为所有作品设置以下标签和/或注释，覆盖导入器在内容里读到的一切。',
    'Who can comment on these works': '谁可以评论这些作品',
    'Submit': '提交',
    'Import': '导入',
    'All works on AO3 must comply with our': 'AO3 上的所有作品都必须遵守我们的',
    'For more information, please refer to our': '更多信息请参考我们的',
    'Terms of Service FAQ': '服务条款常见问题',
    'Notes at the beginning': '开头注释',
    'Notes at the end': '结尾注释',
    'Choose a language *': '选择语言 *',
    'Public Work Skins': '公开的作品皮肤',
    'Save Draft': '保存草稿',
    'Brevity is the soul of wit, but your content does have to be at least 10 characters long.': '简洁是智慧的灵魂，但内容至少要有 10 个字符。',
    'Choose Not To Use Archive Warnings': '选择不使用站内警告',
    'Underage Sex': '未成年人性行为',
    // —— 发布作品页补充 ——
    'This is a translation': '这是翻译作品',
    'Set a different publication date': '设置其他发布日期',
    'Set publication date': '设置发布日期',
    'Basic Formatting': '基础格式',
    'Type or paste formatted text.': '输入或粘贴已排版好的文字。',
    'Warning': '警告',
    'Category': '类别',
    'Undertale Work Skin': 'Undertale 作品皮肤',
    'Post Comment': '发表评论',
    'Plain text with limited HTML': '纯文本，支持有限的 HTML',
    'Brevity is the soul of wit, but we need your comment to have text in it.': '简洁是智慧的灵魂，但评论总得有内容才行。',
    'This work\'s creator has chosen to moderate comments on the work. Your comment will not appear until it has been approved by the creator.': '这篇作品的作者开启了评论审核。你的评论要等作者通过后才会显示。',
    'Work Header': '作品信息',
    'Archive Warning:': '站内警告：',
    'Category:': '类别：',
    'Fandom:': '同人圈：',
    'Rating:': '分级：',
    'Relationships:': '配对：',
    'Characters:': '角色：',
    'Additional Tags:': '附加标签：',
    'No one can comment': '禁止任何人评论',
    'Only registered users can comment': '仅注册用户可评论',
    'Registered users and guests can comment': '注册用户与访客都可评论',
    'Who can comment on this work': '谁可以评论这篇作品',
    'You can however still leave Kudos!': '不过你仍然可以给 Kudos！',
    'Sorry, this work doesn\'t allow comments.': '抱歉，这篇作品不允许评论。',
    'Sorry, you can\'t comment on a draft.': '抱歉，草稿不能评论。',
    'Yes, delete!': '是，删除！',
    'Are you sure you want to delete this comment?': '确定删除这条评论吗？',
    'Editing comment': '编辑评论',
    'Approve All Unreviewed Comments': '通过所有未审核评论',
    'No unreviewed comments.': '没有待审核的评论。',
    'Back to AO3 News Index': '返回 AO3 新闻列表',
    // —— 偏好设置（来自 preferences.*）——
    'Browser page title format': '浏览器标题格式',
    'Display': '显示',
    'Display preferences': '显示偏好',
    'Privacy': '隐私',
    'Privacy preferences': '隐私偏好',
    'Misc': '其他',
    'Misc preferences': '其他偏好',
    'Comment preferences': '评论偏好',
    'Collection preferences': '合集偏好',
    'Collections, Challenges and Gifts': '合集、挑战与礼物',
    'Change Email': '修改邮箱',
    'Change Password': '修改密码',
    'Change Username': '修改用户名',
    'Public Site Skins': '公开站点皮肤',
    'Your locale': '你的语言',
    'Your site skin': '你的站点皮肤',
    'Your time zone': '你的时区',
    'Hide warnings (you can still choose to show them).': '隐藏警告（仍可单独选择显示）。',
    'Hide additional tags (you can still choose to show them).': '隐藏附加标签（仍可单独选择显示）。',
    'Hide work skins (you can still choose to show them).': '隐藏作品皮肤（仍可单独选择显示）。',
    'Show me adult content without checking.': '不再询问，直接显示成人内容。',
    'Show the whole work by default.': '默认显示整篇作品。',
    'Turn on History.': '开启浏览历史。',
    'Turn off emails about comments.': '关闭评论邮件通知。',
    'Turn off emails about kudos.': '关闭 Kudos 邮件通知。',
    'Turn off emails about gift works.': '关闭礼物作品邮件通知。',
    'Turn off copies of your own comments.': '不接收自己评论的副本。',
    'Allow anyone to gift me works.': '允许任何人赠送我作品。',
    'Allow others to invite my works to collections.': '允许他人邀请我的作品加入合集。',
    // —— 偏好设置页（官方 locale preferences.index.*）——
    'Set My Preferences': '设置我的偏好',
    'Edit My Profile': '编辑我的资料',
    'Navigation': '导航',
    'Hide my work from search engines when possible.': '尽可能不让搜索引擎收录我的作品。',
    'Hide the share buttons on my work.': '隐藏作品上的分享按钮。',
    'Allow others to invite me to be a co-creator.': '允许他人邀请我作为共同作者。',
    'Turn off emails from collections.': '关闭合集相关邮件。',
    'Turn off inbox messages from collections.': '关闭合集相关的收件箱消息。',
    'Turn off messages to your inbox about comments.': '关闭评论相关的收件箱消息。',
    'Do not allow guests to reply to my comments on news posts or other users\' works (you can still control the comment settings for your works separately).': '不允许访客回复我在新闻帖或他人作品下的评论（你自己作品的评论设置仍可单独控制）。',
    'Locale preferences help': '语言偏好说明',
    'Work title format': '作品标题格式',
    'Turn off the banner showing on every page.': '关闭每页都显示的横幅。',
    'Turn the new user help banner back on.': '重新开启新用户帮助横幅。',
    // —— 笔名（官方 locale pseuds.*）——
    'Create Pseud': '新建笔名',
    'Back To Pseuds': '返回笔名列表',
    'Pseud deletion': '笔名删除',
    'Are you sure? This can\'t be undone!': '确定吗？此操作无法撤销！',
    'Delete this bookmark': '删除这个书签',
    'Delete these bookmarks': '删除这些书签',
    'Transfer this bookmark to the default pseud': '把这个书签转移到默认笔名',
    'Transfer these bookmarks to the default pseud': '把这些书签转移到默认笔名',
    'When you delete your pseud, any works, series, or comments you have created under it will be transferred to your default pseud.': '删除笔名后，你在其下创建的作品、系列和评论都会转移到默认笔名。',
    // —— 个人资料（profile.*）——
    'Edit Profile': '编辑资料',
    'Change Profile': '修改资料',
    'Edit My Works': '编辑我的作品',
    // —— 页脚 / 布局（layouts.*）——
    'hide banner': '隐藏横幅',
    'View License': '查看许可证',
    'Site': '站点',
    'Dismiss Notice': '不再提示',
    'Important message:': '重要提示：',
    'You are using a proxy site that is not part of the Archive of Our Own.': '你正在使用一个不属于 AO3 的第三方代理站点。',
    'The entity that set up the proxy site can see what you submit, including your IP address. If you log in through the proxy site, it can see your password.': '搭建该代理站点的一方能看到你提交的内容，包括你的 IP 地址。如果你通过代理站点登录，它还能看到你的密码。',
    'While we\'ve done our best to make the core functionality of this site accessible without JavaScript, it will work better with it enabled. Please consider turning it on!': '我们已尽量让本站核心功能在无 JavaScript 时也可用，但启用后体验更好。建议开启。',
    // —— 分页（pagy.*）——
    'Pagination': '分页',
    'Next →': '下一页 →',
    '← Previous': '← 上一页',
    // —— 下载 / 离线阅读（downloads.*）——
    'Preface': '前言',
    'Afterword': '后记',
    'Chapter Notes': '章节批注',
    'Chapter Summary': '章节摘要',
    'Chapter End Notes': '章节末批注',
    'End Notes': '末批注',
    'more notes': '更多批注',
    'Works inspired by this one': '受这篇启发的作品',
    'Stats:': '统计：',
    'Inspired by a deleted work': '受一篇已删除作品启发',
    'Inspired by a work in an unrevealed collection': '受一篇未公开合集里的作品启发',
    'A translation of a deleted work': '一篇已删除作品的翻译',
    'A translation of a work in an unrevealed collection': '一篇未公开合集作品的翻译',
    'drop by the Archive and comment': '到 AO3 上留言评论',
    // —— 书签（bookmarks.*）——
    'Saved': '已保存',
    'Share': '分享',
    'Share Bookmark': '分享书签',
    'Bookmark External Work': '收藏站外作品',
    'Are you sure you want to delete this bookmark?': '确定删除这个书签吗？',
    'try our advanced search': '试试高级搜索',
    'This has been deleted, sorry!': '抱歉，此内容已被删除！',
    // —— 首页 / 通用导航（补充）——
    'My Reading History': '浏览历史',
    'Reading History': '浏览历史',
    'Read more...': '阅读全文…',
    'Read more…': '阅读全文…',
    'Tags': '标签',
    'People': '用户',
    'Follow us': '关注我们',
    'Follow AO3 on Bluesky or Tumblr for status updates, and don\'t forget to check out the Organization for Transformative Works\' news outlets for updates on our other projects!': '关注 AO3 的 Bluesky 或 Tumblr 获取状态更新，也别忘了看看 OTW（再创作组织）的新闻渠道，了解其他项目的进展！',
    'browse fandoms by media or favorite up to 20 tags to have them listed here!': '按媒体类型浏览同人圈，或收藏最多 20 个标签，它们会显示在这里！',
    'Profile': '个人资料',
    'Skins': '皮肤',
    'Skins:': '皮肤：',
    'Inbox': '收件箱',
    'Inbox (0)': '收件箱（0）',
    'Drafts': '草稿',
    'Sign-ups': '报名',
    'Assignments': '任务',
    'Claims': '领取',
    'Related Works': '相关作品',
    'Publish': '发布',
    'Publish New': '发布新作品',
    'Post New': '发布新作品',
    'Subscribe': '订阅',
    'Unsubscribe': '取消订阅',
    'Invitations': '邀请',
    'Edit Works': '编辑作品',
    'Update': '更新',
    'Dismiss': '忽略',
    'Dismiss permanently': '不再提示',
    'a new work': '新作品',
    'a new bookmark': '新书签',
    'Pseuds': '笔名',
    'Pseud': '笔名',
    'Bio': '简介',
    'Joined': '加入时间',
    'Joined:': '加入时间：',
    'Gifts': '礼物',
    'Gifts:': '礼物：',
    'Kudos Given': '送出的 Kudos',
    'Kudos Given:': '送出的 Kudos：',
    'Kudos Received': '收到的 Kudos',
    'Kudos Received:': '收到的 Kudos：',
    'Subscriptions': '订阅',
    'Dashboard': '主页',
    'Manage Pseuds': '管理笔名',
    'Edit Preferences': '编辑偏好设置',
    'Manage Subscriptions': '管理订阅',
    'Default Rating': '默认分级',
    'Default Language': '默认语言',
    'English': '英语',
    'Chinese': '中文',
    'You have no subscriptions.': '你还没有订阅。',
    'You have no works.': '你还没有作品。',
    'You have no bookmarks.': '你还没有书签。',
    'Bookmarks:': '书签：',
    'Works:': '作品：',
    'Comments:': '评论：',
    'Comments Received:': '收到的评论：',
    'Hits:': '点击：',
    'Title': '标题',
    'Title:': '标题：',
    'Sort by:': '排序方式：',
    'Date Posted': '发布日期',
    'Date': '日期',
    'Published:': '发表于：',
    'Updated:': '更新于：',
    'Completed:': '完结于：',
    'Completed': '已完结',
    'Updated': '已更新',
    'Published': '已发表',
    'Complete': '完结',
    'Completed: Yes': '完结：是',
    'Completed: No': '完结：否',
    'Mark for Later': '稍后阅读',
    'Marked for Later': '已标记稍后阅读',
    'Download': '下载',
    'Hide Creator\u2019s Style': '隐藏作者样式',
    'Show Creator\u2019s Style': '显示作者样式',
    'Entire Work': '全文',
    'Chapter Text': '正文',
    'Next Chapter': '下一章',
    'Previous Chapter': '上一章',
    'Table of Contents': '目录',
    'Top of Form': '表单顶部',
    'Bottom of Form': '表单底部',
    'Actions': '操作',
    'Edit': '编辑',
    'Delete': '删除',
    'Delete Work': '删除作品',
    'Add Chapter': '添加章节',
    'Edit Chapter': '编辑章节',
    'Edit Work': '编辑作品',
    'Edit Tags': '编辑标签',
    'Bookmark': '收藏',
    'Edit Bookmark': '编辑书签',
    'Delete Bookmark': '删除书签',
    'Comments (': '评论（',
    'Leave a comment': '留下评论',
    'Cancel': '取消',
    'Save': '保存',
    'Save Changes': '保存修改',
    'Close': '关闭',
    'Back': '返回',
    'Next': '下一页',
    'Previous': '上一页',
    'Next \u203a': '下一页 \u203a',
    '\u2039 Previous': '\u2039 上一页',
    'First': '首页',
    'No results found.': '没有找到结果。',
    'Sorry, we couldn\u2019t find any results for that search.': '抱歉，没有找到符合该搜索的内容。',
    // —— 筛选 / 排序 ——
    'Filters': '筛选',
    'Sort and Filter': '排序与筛选',
    'Sort By': '排序方式',
    'Filter': '筛选',
    'Filters:': '筛选：',
    'Clear Filters': '清除筛选',
    'Apply': '应用',
    'Reset': '重置',
    'Show': '显示',
    'Show All': '全部显示',
    'Any': '不限',
    'All': '全部',
    'None': '无',
    'Yes': '是',
    'No': '否',
    'Hits (descending)': '点击数（降序）',
    'Kudos (descending)': 'Kudos（降序）',
    'Comments (descending)': '评论数（降序）',
    'Bookmarks (descending)': '书签数（降序）',
    'Other tags': '其它标签',
    'Include': '包含',
    'Exclude': '排除',
    'Only': '仅',
    'Any field': '任意字段',
    'Complete Only': '仅完结',
    'Single Chapter': '单章',
    'Multi Chapter': '多章',
    'Categories': '类别',
    'F/M': 'F/M',
    'Teen And Up Audiences': '青少年及以上',
    'General Audiences': '全年龄',
    'Mature': '成人',
    'Explicit': '露骨',
    'Not Rated': '未分级',
    'No Archive Warnings Apply': '无站内警告',
    'Creator Chose Not To Use Archive Warnings': '作者选择不使用站内警告',
    'Major Character Death': '主要角色死亡',
    'Underage': '未成年性行为',
    'Rape/Non-Con': '强奸/非自愿',
    // —— 书签 / 合集 ——
    'Bookmark Tags': '书签标签',
    'Bookmark Notes': '书签注释',
    'Bookmark Type': '书签类型',
    'Private': '私密',
    'Public': '公开',
    'Notes:': '注释：',
    'External Work': '外部作品',
    'Collection': '合集',
    'Bookmarked:': '收藏于：',
    // —— 评论 / 互动 ——
    'Comment Thread': '评论串',
    'Reply': '回复',
    'Thread': '楼层',
    'Guest': '游客',
    'Comment on this work': '评论这篇作品',
    // —— 表单通用 ——
    'Email': '邮箱',
    'Email address': '邮箱地址',
    'Username': '用户名',
    'Username or email': '用户名或邮箱',
    'Password': '密码',
    'Remember me': '记住我',
    'Forgot password?': '忘记密码？',
    'First Name': '名字',
    'Last Name': '姓氏',
    'Select': '请选择',
    'Choose': '请选择',
    'Required': '必填',
    'Optional': '可选',
    // —— 分页 / 提示 ——
    'Next Page': '下一页',
    'Previous Page': '上一页',
    'Loading': '加载中',
    'Loading\u2026': '加载中…',
    'Error': '出错了',
    'Success': '成功'
  };

  /** 长句片段替换（正则全局替换，只匹配界面套话，不匹配用户内容） */
  const PATTERNS = [
    [/\bPublished:\s*/g, '发表于：'],
    [/\bUpdated:\s*/g, '更新于：'],
    [/\bCompleted:\s*/g, '完结于：'],
    [/\bWords:\s*/g, '字数：'],
    [/\bChapters:\s*/g, '章节：'],
    [/\bLanguage:\s*/g, '语言：'],
    [/\bKudos:\s*/g, 'Kudos：'],
    [/\bHits:\s*/g, '点击：'],
    [/\bComments:\s*/g, '评论：'],
    [/\bBookmarks:\s*/g, '书签：'],
    [/\bCollections:\s*/g, '合集：'],
    [/\bSeries:\s*/g, '系列：'],
    [/\bStats:\s*/g, '统计：'],
    [/\bNotes:\s*/g, '注释：'],
    [/\bSummary:\s*/g, '摘要：'],
    [/\b(\d[\d,]*)\s+words?\b/gi, '$1 字'],
    [/\b(\d[\d,]*)\s+characters?\s+left\b/gi, '$1 剩余字符'],
    // 浏览历史页的时间文案："Visited 44 times" / "Visited once"
    [/\bVisited\s+(\d[\d,]*)\s+times?\b/gi, '已浏览 $1 次'],
    [/\bVisited\s+once\b/gi, '已浏览 1 次'],
    // 历史页那句里的括号版本标记（整段里长度不够，字典查不到，用模式补）
    [/\(Latest version\.\)/gi, '（最新版本）'],
    [/\(Latest version\)/gi, '（最新版本）'],
    // 搜索框提示：只翻开头的 "tip:" 标签，后面的示例查询原样保留
    [/^\s*tip:\s*/i, '提示：'],
    // 收件箱标题："My Inbox (2 comments, 1 unread)"（数字是变量）
    [/\bMy Inbox\s*\(\s*(\d[\d,]*)\s*comments?\s*,\s*(\d[\d,]*)\s*unread\s*\)/gi,
      '我的收件箱（$1 条评论，$2 条未读）'],
    [/\bMy Inbox\b/gi, '我的收件箱'],
    [/\b(\d[\d,]*)\s*comments?\s*,\s*(\d[\d,]*)\s*unread\)?/gi, '$1 条评论，$2 条未读）'],
    // "XB356's Collections" 这类带用户名的标题（集合页/统计页等）
    [/([A-Za-z0-9_-]+)&#39;s Collections\b/g, '$1 的合集'],
    [/([A-Za-z0-9_-]+)'s Collections\b/g, '$1 的合集'],
    // 日期："04 Oct 2026" -> "2026 年 10 月 4 日"（月份用数字，避免二次替换）
    // 注意：必须排除带时间戳的形式（"Fri, 02 Oct 2026 07:14PM UTC"），
    // 那类属于站点动态格式，硬翻会读起来别扭，也会破坏已有排版。
    [/(^|[^A-Za-z0-9])(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\s+(\d{4})\b(?!\s+\d{1,2}:\d{2})/g,
      function (all, pre, d, mon, y) {
        const map = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sept: 9, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
        return pre + y + ' 年 ' + map[mon] + ' 月 ' + Number(d) + ' 日';
      }],
    [/\b(\d[\d,]*)\s+hits?\b/gi, '$1 次点击'],
    [/\b(\d[\d,]*)\s+kudos\b/gi, '$1 个 Kudos'],
    [/\b(\d[\d,]*)\s+comments?\b/gi, '$1 条评论'],
    [/\b(\d[\d,]*)\s+bookmarks?\b/gi, '$1 个书签'],
    [/\b(\d[\d,]*)\s+chapters?\b/gi, '$1 章'],
    [/\b(\d[\d,]*)\s+works?\b/gi, '$1 篇作品'],
    [/\b(\d[\d,]*)\s+Collections?\b/g, '$1 个合集'],
    [/\b(\d[\d,]*)\s+Series\b/g, '$1 个系列'],
    [/\bWorks?\s+in\s+/g, '作品 / '],
    [/\bResults?\s+(\d[\d,]*)/gi, '结果 $1'],
    [/of\s+(\d[\d,]*)\s+Works?\b/g, '共 $1 篇'],
    [/\bChapter\s+(\d+)\s+of\s+(\d+)/gi, '第 $1 章 / 共 $2 章'],
    [/\bComments?\s*\((\d[\d,]*)\)/g, '评论（$1）'],
    [/\bHits?\s*\((\d[\d,]*)\)/gi, '点击（$1）'],
    [/\bKudos\s*\((\d[\d,]*)\)/gi, 'Kudos（$1）'],
    // Kudos 那行：", and " 是用户名之间的分隔，直接换成中文顿号。
    // 前面用 \s? 而不是 \s*：\s* 会吞掉上一个节点的尾空格，
    // 替换后会出现 "XB356, 、Mishalito" 这种多余逗号。
    [/\s?,\s+and\s+/g, '、'],
    // "as well as 3 guests left kudos on this work!"（数字是变量）
    // 只保留这条整体模式：不能再单独加 "left kudos on this work!"，
    // 否则两条规则叠加会出现 "…留下了 Kudos！... Kudos on this work!" 的重复（踩过坑）。
    [/\bas well as\s+(\d[\d,]*)\s+guests?\s+left\s+kudos\s+on\s+this\s+work!/gi, '以及 $1 位访客给这篇作品留下了 Kudos！'],
    [/\bas well as\s+(\d[\d,]*)\s+guests?\s+left\s+kudos/gi, '以及 $1 位访客留下了 Kudos'],
    // 中文语境下不需要空格，顺手收一下
    [/\s+([，。、：（）])/g, '$1'],
    [/([（])\s+/g, '$1']
  ];

  /**
   * 属性翻译。
   * value 只翻"按钮/提交"控件——文本输入框的 value 是用户输入的内容，绝不能动。
   */
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const VALUE_ATTR = 'value';
  const BUTTON_INPUT_TYPES = { submit: 1, button: 1, reset: 1 };

  /** 动态生成文案所在的属性（AO3 的订阅按钮文字来自 data-create-value） */
  const DATA_VALUE_ATTRS = ['data-create-value', 'data-destroy-value'];

  /** 绝对不翻译的区域：
   *  - 用户内容：正文、摘要、注释、标签、评论
   *  - 编辑器：可编辑区
   * 注意：input / textarea 属于表单控件，其文字值不会被翻，但 placeholder 属于界面文案，仍要翻。 */
  const KEEP_USER_CONTENT = [
    '#workskin',
    // 用户自己写的内容（正文 / 简介 / 摘要 / 注记 / 评论）
    'blockquote',
    // 注意：不能按容器 (#main .notes / .summary / .comment) 跳过。
    // 同一容器里既有用户写的正文，也有界面文案（dt 上的 "Summary"、"Notes" 标签），
    // 按容器跳过会连标签一起挡掉，表现为"发布页的 Summary / Notes 没翻"。
    // 但也不能用宽泛的 '.userstuff'：资料页/测试页把 .userstuff 放在 #main 这种
    // 大容器上，一刀切会把整页界面文案都跳过。所以这里只保留精确的内容选择器。
    '#main .comment',
    '.comment',
    // 注意：**不能**把 .comment-form 整个跳过。
    // 评论表单里除了用户输入（textarea 已单独跳过）还有大量界面文案：
    // Post Comment / Comment as / Plain text with limited HTML / 评论审核提示 等，
    // 一旦整块跳过，评论区就永远是英文（踩过这个坑）。
    // 同理 **.kudos 也不能跳过**：#kudos 里只有用户名链接和
    // "as well as N guests left kudos on this work!" 这类站点文案，
    // 没有用户撰写的内容（要保护的是 .userstuff / blockquote / textarea）。
    // 个人资料页的简介正文：AO3 用的是 .bio .userstuff，
    // 注意不能把整个 .userstuff 一刀切，否则资料页的界面元素也全被跳过
    '.bio .userstuff',
    '.bio blockquote',
    '.pseud .bio',
    '[contenteditable="true"]',
    '.ao3tm-panel-root',
    '.ao3tm-menu',
    '.ao3tm-toast',
    '.ao3tm-bar',
    '.ao3tm-tools',
    '.ao3tm-workbar',
    '.ao3tm-fab',
    '.ao3tm-focus',
    '.ao3tm-tag',
    '.ao3tm-hide',
    '.ao3tm-chip'
  ].join(', ');

  /** 文本节点：用户内容 + 这些标签的文字都跳过 */
  const SKIP_SELECTOR = [KEEP_USER_CONTENT, 'textarea', 'script', 'style', 'code', 'pre'].join(', ');

  /** 这些标签本身没有可翻译的文字节点，跳过以免误伤 */
  const SKIP_TEXT_TAGS = { INPUT: 1, TEXTAREA: 1, SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1 };

  let observer = null;
  let timer = null;
  /** 当前处理的文本节点所属元素：片段替换只允许在界面元素里发生 */
  let textNodeEl = null;
  /** 已经翻译过的文本节点（用 WeakSet，避免 DOM 标记带来的误判） */
  const doneNodes = new WeakSet();
  let running = false;

  function currentSettings() {
    const store = root.AO3TM && root.AO3TM.store;
    return (store && store.get().settings) || {};
  }

  /**
   * 查词典（子串匹配：key 是 text 的子串也算命中）。
   * 这样 "Joined: 12 March 2019" 这种挤在一个文本节点里的文案也能翻。
   * 代价：标题/正文里出现 Characters、Tags 这类词也会被替换，
   * 所以对"可能是用户内容"的文本必须先用 looksLikeRichText() 拦住。
   */
  function lookup(text) {
    if (typeof text !== 'string') return null;
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(PHRASES, key)) return PHRASES[key];
    const lower = key.toLowerCase();
    const found = Object.keys(PHRASES).filter(function (k) {
      return k.toLowerCase() === lower;
    })[0];
    return found ? PHRASES[found] : null;
  }

  /**
   * 这段文本像不像"用户内容 / 富文本"——那样就不做分段与内嵌替换。
   * 判据（命中任一即视为不能碰）：
   *   · 含 URL、或 AO3 的筛选语法（tip: … sort:…）
   *   · 多于一句（句末标点后还有实词）
   *   · 偏长（>60 字，多半是标题或正文）
   * 但"长文本里含已知界面短语"要放行：AO3 的欢迎语、条款提示都是长句，
   * 不能因为长就把正常翻译也挡掉。
   */
  function containsKnownPhrase(text) {
    if (INLINE_PHRASES === null) inlinePhrases(); // 预热，避免首次调用时未初始化
    const keys = INLINE_PHRASES || [];
    for (let i = 0; i < keys.length; i++) {
      if (text.indexOf(keys[i]) !== -1) return true;
    }
    return false;
  }

  function looksLikeRichText(text) {
    const value = String(text || '').trim();
    if (!value) return false;
    if (/:\/\//.test(value)) return true;
    if (/\b(tip|sort|words|hits|kudos|language)\s*[:>]/i.test(value)) return true;
    if (containsKnownPhrase(value)) return false; // 含界面短语，按界面文案处理
    if (/[.!?]\s+[A-Za-z]/.test(value)) return true;
    if (value.length > 60) return true;
    return false;
  }

  /**
   * 和 lookup 一样，但额外返回"命中的是哪条 key"。
   * 调用方需要知道原文里被消费掉的长度（译文长度和原文长度不一样）。
   */
  function lookupWithKey(text) {
    if (typeof text !== 'string') return null;
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(PHRASES, key)) return { key: key, value: PHRASES[key] };
    const lower = key.toLowerCase();
    const found = Object.keys(PHRASES).filter(function (k) {
      return k.toLowerCase() === lower;
    })[0];
    return found ? { key: found, value: PHRASES[found] } : null;
  }

  function applyPatterns(text) {
    let out = text;
    for (let i = 0; i < PATTERNS.length; i++) {
      out = out.replace(PATTERNS[i][0], PATTERNS[i][1]);
    }
    return out;
  }

  function shouldSkip(node, bilingual) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    // 绝不翻译插件自己的控件：卡片上的标签 chip 里带着标签原文
    // （例如 <span class="ao3tm-tag" data-tag="Top Park Jongseong | Jay">），
    // 一旦被翻，标签名就被破坏（"Top" 曾变成 "回到顶部"）。
    if (el.closest && el.closest('[class*="ao3tm-"]')) return true;
    // 评论表单是例外：它外层带 .comment，但里面全是界面文案，要放行
    const inSkip = el.closest(SKIP_SELECTOR) || null;
    const isForm = isCommentForm(el);
    if (inSkip && !isForm) return true;
    if (SKIP_TEXT_TAGS[el.tagName]) return true;
    // 已翻过的文本节点用 WeakSet 记录：
    // 不要用 DOM 标记判断——早先在父元素上打标记会把同段落里其它文本节点
    // 一起跳过（表现为"半句中文半句英文"）；插标记 span 又会和别的节点的
    // previousSibling 撞上，同样误判。
    if (doneNodes.has(node)) {
      if (bilingual) {
        const orig = el.getAttribute('data-ao3tm-orig');
        if (orig && !el.getAttribute('title')) el.setAttribute('title', orig);
        if (orig) el.setAttribute('data-ao3tm-bilingual', '1');
      }
      return true;
    }
    return false;
  }

  /** 属性翻译只针对界面属性：input 的 placeholder、aria-label 等，不碰 value/title */
  const ATTR_SKIP = {
    SCRIPT: 1,
    STYLE: 1,
    TEXTAREA: 1,
    CODE: 1,
    PRE: 1,
    SELECT: 1,
    OPTION: 1
  };

  function shouldSkipAttr(el) {
    if (!el || !el.getAttribute) return true;
    if (ATTR_SKIP[el.tagName]) return true;
    if (el.closest(KEEP_USER_CONTENT) && !isCommentForm(el)) return true;
    return false;
  }

  /**
   * 评论表单：AO3 把它包在 <div class="post comment" id="comment_form_for_*"> 里，
   * 会被 KEEP_USER_CONTENT 的 '.comment' 命中而整块跳过，
   * 导致 Post Comment / Comment as / Plain text with limited HTML / 评论审核提示
   * 永远不翻。这里精确识别这块，放行它的界面文案；
   * 真正由用户书写的评论仍在 '.comment' / '.userstuff' 保护下。
   */
  function isCommentForm(el) {
    if (!el || !el.closest) return false;
    // 表单容器本身（含 #add_comment_placeholder 外壳）
    if (el.closest('#add_comment, #add_comment_placeholder')) return true;
    if (el.closest('form.new_comment, form.comment-form')) return true;
    // <div class="post comment" id="comment_form_for_…">
    const holder = el.closest('div.comment');
    if (holder) {
      const id = holder.getAttribute ? holder.getAttribute('id') || '' : '';
      if (id.indexOf('comment_form') === 0) {
        // 只放行表单元素，不动用户评论正文
        if (el.closest('textarea, .userstuff, blockquote, .comment .comment')) return false;
        return true;
      }
    }
    return false;
  }

  /**
   * 分段翻译：AO3 常把界面文案拆成多个节点或与标点混在一起
   * （例如 "Joined:" 被拆成 "Joined" + ":"，或 "Default Rating: Not Rated" 挤在一个节点里）。
   * 整段匹配失败时，按分隔符切开、逐段查词典，再按原样拼回去；
   * 只要至少一段命中就采用新文本，避免误翻用户名/正文。
   */
  function translateCompound(text) {
    const parts = String(text).split(/([：:（()）·、，,。!?！？【】\[\]|]+)/);
    let hit = false;
    const out = parts
      .map(function (part) {
        if (!part || /^[\s：:（()）·、，,。!?！？【】\[\]|]*$/.test(part)) return part;
        const trimmed = part.trim();
        if (!trimmed) return part;
        const translated = lookup(trimmed);
        if (translated) {
          hit = true;
          return part.replace(trimmed, translated);
        }
        // "Default Rating" 这种短语查不到时，再试着按空格前缀/后缀切
        const words = trimmed.split(/\s+/);
        if (words.length >= 2) {
          for (let take = words.length - 1; take >= 1; take--) {
            const head = words.slice(0, take).join(' ');
            const headTranslated = lookup(head);
            if (headTranslated) {
              hit = true;
              return part.replace(head, headTranslated);
            }
          }
        }
        return part;
      })
      .join('');
    if (!hit) return null;
    // 和 translateInlinePhrases 同样的"结果校验"：
    // 分段替换后若仍中英夹杂，说明原文是句子/短语而不是可分段界面文案，
    // 宁可放弃（例如 "Post to Collections / Challenges" 曾被拼成
    // "发布 to Collections / Challenges"）。
    if (looksSentenceLike(String(text), out, textNodeEl)) return null;
    return out;
  }

  /**
   * 长句里的界面短语：整段匹配失败时的最后一招。
   * AO3 有些句子把界面文案和链接混在一个文本节点里（例如
   * "Hi! It looks like you've just logged in to AO3 for the first time. For help …"），
   * 这类整句翻不了，但里面嵌着可翻译的固定短语。
   * 为降低误伤用户正文的风险，只处理**较长且高度站点化**的短语（>= PHRASE_MIN_LEN 个字符）。
   */
  const PHRASE_MIN_LEN = 12;
  let INLINE_PHRASES = null;

  /**
   * 这些词条**只能整段精确匹配**，绝不参与分段/内嵌替换。
   * 它们要么是连接词/虚词（or、and），要么本身是普通英文单词（Default、Share…），
   * 一旦被当作片段去替换，就会把作品标题、笔名、皮肤名切得七零八落
   * （例如 "By Choice, by Fate, or Neither" 变成 "By Choice, by Fate, 或 Neither"）。
   */
  const EXACT_ONLY = {
    'or': 1,
    'and': 1,
    'publish': 1,
    'Top': 1,
    'top': 1,
    'Last': 1,
    'last': 1,
    'Or': 1,
    'or': 1,
    'Preferences': 1,
    'Default': 1,
    // 内置站点皮肤名属于数据，一律不翻（也不允许被片段替换）
    'Reversi': 1,
    'Low Vision Default': 1,
    'Snow Blue': 1,
    'Snow': 1,
    'Customize': 1,
    'Share': 1,
    'From': 1,
    'To': 1,
    'Site': 1,
    'Rules': 1,
    'Prompts:': 1,
    'Contents': 1,
    'Block': 1,
    'Unblock': 1,
    'Mute': 1,
    'Unmute': 1,
    'Either': 1,
    'Closed': 1,
    'Moderated': 1,
    'Canonical': 1,
    'Synonymous': 1,
    'Unwrangleable': 1,
    'Note': 1
  };

  /**
   * 内嵌替换要排除的短语：这些是 AO3 的"标签类别名 / 分级名"，
   * 会正常出现在作品标题、标签名、新闻标题里（例如
   * 《Updates to "No Fandom" Additional Tags》）——那时不该翻。
   * 它们作为独立文案时仍走整段精确匹配（lookup），不受这里影响。
   */
  const INLINE_EXCLUDE = {
    'Additional Tags': 1,
    'Archive Warning': 1,
    'Archive Warnings': 1,
    'Creator Chose Not To Use Archive Warnings': 1,
    'No Archive Warnings Apply': 1,
    'Major Character Death': 1,
    'Choose Not To Use Archive Warnings': 1,
    'General Audiences': 1,
    'Teen And Up Audiences': 1,
    'Not Rated': 1,
    'Donate': 1,
    'Volunteer': 1,
    'Donate or Volunteer': 1,
    'Set your preferences now': 1,
    'Preferences': 1,
    'Work in Progress': 1,
    'Work In Progress': 1,
    'Complete Work': 1,
    'Completed Work': 1
  };

  function inlinePhrases() {
    if (INLINE_PHRASES) return INLINE_PHRASES;
    INLINE_PHRASES = Object.keys(PHRASES)
      .filter(function (key) {
        if (INLINE_EXCLUDE[key]) return false;
        if (EXACT_ONLY[key]) return false; // 连接词/普通单词只允许整段匹配
        return key.length >= PHRASE_MIN_LEN && /[A-Za-z]/.test(key);
      })
      // 长的先替换，避免短词把长句切碎
      .sort(function (a, b) {
        return b.length - a.length;
      });
    return INLINE_PHRASES;
  }

  function escRe(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 内嵌替换后的标点清理。
   * 英文原文用 "." 和 "( )"，替换出中文后会和残留的西文标点挤在一起
   * （例如"…实用提示 也可以…常见问题."），这里把明显的重复/混用收干净。
   */
  function tidyPunctuation(text) {
    return String(text)
      .replace(/[（(]\s*[)）]/g, '')
      .replace(/[。.]\s*\./g, '。')
      .replace(/。\s*\./g, '。')
      .replace(/\.\s*。/g, '。')
      .replace(/([\u4e00-\u9fa5])\s*\.(\s|$)/g, '$1。$2')
      .replace(/([\u4e00-\u9fa5])\s*,\s*/g, '$1，')
      // kudos 用户名之间的分隔：半角逗号 + 连接词（、或 与）→ 顿号
      .replace(/\s*,\s*[、与]\s*/g, '、')
      .replace(/\s+(?=[、，。：；！？])/g, '')
      // 中文顿号后又出现空格、且后面跟的是西文（用户名等）：去掉这个空格
      .replace(/([、，。：；！？])\s+(?=[A-Za-z0-9@])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * 内嵌短语替换。
   * 关键细节：HTML 会折叠空白，但 DOM 的文本节点里可能保留多个空格/换行/&nbsp;，
   * 而词典里的 key 是单个空格。早先用"把 key 里的空格换成 \s+ 再拼正则"的做法，
   * 在多空格文本上仍然匹配不上——改成**两边都先折叠空白再匹配**，更可靠也更简单。
   */
  const collapseWs = function (text) {
    return String(text).replace(/[\u3000\u00a0]/g, ' ').replace(/\s{2,}/g, ' ').replace(/\n/g, ' ');
  };

  function translateInlinePhrases(text) {
    if (typeof text !== 'string' || !text) return null;
    const flat = collapseWs(text);
    let out = flat;
    let hit = false;
    inlinePhrases().forEach(function (key) {
      const flatKey = collapseWs(key);
      if (out.indexOf(flatKey) === -1) return;
      // 只在整词边界上替换，避免把 plan/tag 这类子串误翻
      const re = new RegExp('(^|[^A-Za-z0-9])' + escRe(flatKey) + '(?![A-Za-z0-9])', 'g');
      if (!re.test(out)) return;
      out = out.replace(re, function (all, pre) {
        hit = true;
        return pre + PHRASES[key];
      });
    });
    if (!hit) return null;
    // 结果校验：片段替换后若仍然中英夹杂，说明原文是"句子"而不是界面短语
    // （例如 "Brief summary of 服务条款 violation (required)"、"配对 help"、
    //   "订阅 and Feeds FAQ"），这类宁可放弃替换，也不要翻出半英半中。
    if (looksSentenceLike(flat, out, textNodeEl)) return null;
    return tidyPunctuation(out);
  }

  /**
   * 片段替换只允许发生在"明确的界面元素"里。
   * 同人圈/作品/标签列表这类用户数据不在白名单内，
   * 否则会把作品名改坏（曾出现 "All About Eve -> 全部 About Eve"、
   * "Lazy Town -> 筛选 Laz Town"、"Angels -> 关于 Angels"）。
   */
  function inUiRegion(el) {
    // 没有元素上下文（单元测试直接调用 translate()）时放行，
    // 只在真实页面（translateTextNode 会设置 textNodeEl）里做区域约束。
    if (!el || !el.tagName) return true;
    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'LABEL' || tag === 'LEGEND' || tag === 'TH' || tag === 'DT') return true;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'OPTION') return true;
    if (el.closest && el.closest('.navigation, .actions, .filters, .submit, .landmark, #footer, #header, form')) return true;
    return false;
  }

  /** "替换后仍中英夹杂"的文本，是否更像句子（而非界面短语） */
  function looksSentenceLike(source, result, el) {
    if (!el && textNodeEl) el = textNodeEl;
    // 不在界面区域内时，一律不做片段替换
    if (!inUiRegion(el)) return true;
    if (!/[\u4e00-\u9fa5]/.test(result)) return false;
    // 结果里是否还有成词的英文（品牌/术语白名单除外）
    const rest = result.replace(/\b(AO3|OTW|Kudos|RSS|CSV|HTML|PNG|JPEG|GIF|TWC|Fanlore|Jira|URL|FAQ|TOS|DMCA|TIDA)\b/g, ' ');
    if (!/[A-Za-z]{3,}/.test(rest)) return false;
    // 原文较长或成词数多 -> 按句子处理（欢迎语这类整句会落到这里，
    // 但它们的整段 key 早已在 lookup 阶段命中，不会走到这一步）
    const words = String(source).split(/\s+/).filter(Boolean).length;
    if (source.length > 24 || words > 4) return true;
    return false;
  }

  /**
   * 去掉"游离的英文冠词"：AO3 会把 The 单独切成一个文本节点，
   * 中文里没有对应词，留着就会出现 "The AO3（Archive of Our Own）（AO3）…"
   * 这种半英半中（多个翻译扩展叠加时尤其明显）。
   * 只在这个节点确实位于链接/强调元素旁时调用，不会误伤 "The Hobbit"。
   */
  function removeDanglingArticle(node, trimmed) {
    doneNodes.add(node);
    // 保留原有的前后空白，中文才会和相邻链接分开
    const lead = /^\s/.test(node.nodeValue) ? ' ' : '';
    const trail = /\s$/.test(node.nodeValue) ? ' ' : '';
    node.nodeValue = lead + trail || ' ';
    if (node.parentElement) node.parentElement.setAttribute(ATTR, '1');
    return true;
  }

  function translateTextNode(node, bilingual) {
    if (!node.nodeValue || !/\S/.test(node.nodeValue)) return false;
    textNodeEl = node.parentElement;
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed) return false;

    // 特例：AO3 在「关于我们」页把首段的定冠词单独切成了一个文本节点：
    //     <p> The <a>Archive of Our Own</a> (AO3) is a non-profit…</p>
    // 中文里没有对应词，直接把这个孤立的 "The" 去掉，免得出现
    // "The AO3（Archive of Our Own）（AO3）是一个非营利…" 这种半英半中。
    // 严格限定"前方是链接/强调元素、且原文就是 The/the"，避免误伤作品标题。
    // 用 previousElementSibling：AO3 的 <p> 里 "The " 前面往往还有一个
    // 只含换行缩进的文本节点，用 previousSibling 判不到那个 <a>（踩过这个坑）。
    const prevEl = node.previousElementSibling;

    // 面包屑标题：AO3 把 "同人圈 > 戏剧" 写成「链接 + "> 分类名"」，
    // 于是分类名所在的文本节点实际是 "> Theater"（含分隔符），
    // 整段匹配不上词典。这里只翻分隔符后面的部分。
    const crumb = trimmed.match(/^([>›»]\s*)(.+)$/);
    if (crumb) {
      const crumbText = lookup(crumb[2].trim());
      if (crumbText) {
        const isOrig = node.nodeValue;
        const lead = isOrig.match(/^\s*/)[0];
        const trail = isOrig.match(/\s*$/)[0];
        doneNodes.add(node);
        node.nodeValue = lead + crumb[1] + crumbText + trail;
        if (node.parentElement) node.parentElement.setAttribute(ATTR, '1');
        return true;
      }
    }

    if (/^(The|the)$/.test(trimmed)) {
      // 判断这个孤立冠词后面是否紧跟一个元素（通常是 <a> 链接）。
      // 不用 previousElementSibling：真实页面里它可能返回 null
      // （模板/其它脚本插入节点后会出现同层兄弟状态不一致），
      // 改用"从父元素子节点列表里定位自己"的方式，稳一点。
      let followedByEl = !!node.nextElementSibling;
      if (!followedByEl && prevEl) followedByEl = true;
      if (!followedByEl) {
        const parent = node.parentElement;
        if (parent && parent.childNodes) {
          const list = parent.childNodes;
          const i = Array.prototype.indexOf.call(list, node);
          for (let j = i + 1; j < list.length; j++) {
            if (list[j].nodeType === 1) { followedByEl = true; break; }
            if (String(list[j].nodeValue || '').trim()) break; // 中间有实义文本就不算
          }
        }
      }
      if (followedByEl) {
        removeDanglingArticle(node, trimmed);
        return true;
      }
    }

    // 兜底：文本恰好是 The/the，且紧邻的下一个元素已经是中文译文
    if (/^(The|the)$/.test(trimmed)) {
      const nextEl = node.nextElementSibling;
      if (nextEl && /[\u4e00-\u9fa5]/.test(nextEl.textContent || '')) {
        removeDanglingArticle(node, trimmed);
        return true;
      }
    }

    // 用 lookupWithKey 拿到"命中的是原文里的哪一段"，
    // 剩余部分要按**原文的字符位置**切，不能按译文长度切——
    // 按译文长度切会把英文尾巴切错（曾导致 "Donate or Volunteer"
    // 变成 "捐赠或参与志愿或 Volunteer"）。
    const hit = lookupWithKey(trimmed);
    let next = hit ? hit.value : null;
    let rest = hit ? trimmed.slice(hit.key.length) : '';
    if (!next) {
      const patterned = applyPatterns(trimmed);
      if (patterned !== trimmed) {
        next = patterned;
        rest = '';
      }
    }
    // 命中前缀后，把剩下的部分也翻掉。
    // AO3 常把一个 <p> 的文字和链接连在同一个文本节点里，
    // 例如 "Hi! … for the first time. For help getting started on AO3, check out some<a>…</a>"。
    if (next && rest && /[A-Za-z]{3}/.test(rest) && !looksLikeRichText(rest)) {
      const restTranslated = translateCompound(rest) || translateInlinePhrases(rest);
      if (restTranslated) next = next + restTranslated;
    }
    // 像是用户内容/富文本（标题、公告正文、筛选语法）时，
    // 只认"整段命中"，不做分段与内嵌替换 ——
    // 否则标题里的 Characters、Tags 这类词会被替换掉。
    if (!next && !looksLikeRichText(trimmed)) {
      next = translateCompound(trimmed);
    }
    if (!next && !looksLikeRichText(trimmed)) {
      next = translateInlinePhrases(trimmed);
    }
    if (!next || next === trimmed) return false;

    // 统一出口再收一次标点：不同分支（整段命中 / 分段 / 内嵌）都会走到这里，
    // 避免"逗号紧挨顿号"这类混用漏掉。
    next = tidyPunctuation(next);

    const leading = original.match(/^\s*/)[0];
    const trailing = original.match(/\s*$/)[0];
    // 译文以中文收尾时，后面的西文空格要去掉
    let value = leading + next + (/[\u4e00-\u9fa5]\s*$/.test(next) ? trailing.replace(/^\s+/, '') : trailing);
    // 译文以中文开头时，前面留一个空格：
    // AO3 大量 "链接</a> imports at-risk…" 这类结构，纯排版需要这个空格，
    // 否则中文会紧贴在链接上（用户反馈的 "Open Doors（开放之门），把濒危…"）
    if (/^[\u4e00-\u9fa5]/.test(next) && !/^\s/.test(value)) value = ' ' + value;
    const el = node.parentElement;

    // 只记录"这一个文本节点"已翻译。
    // 一个 <p> 里常有好几个文本节点（被 <a> 链接切开），
    // 早先给父元素打标记会让同段落里其余节点被整体跳过 —— 表现为"半句中文半句英文"。
    doneNodes.add(node);
    node.nodeValue = value;

    if (el) {
      // 原文记在父元素上：用于"悬停显示原文"，也便于排查
      if (!el.getAttribute('data-ao3tm-orig')) el.setAttribute('data-ao3tm-orig', trimmed);
      el.setAttribute(ATTR, '1');
      if (bilingual) {
        if (!el.getAttribute('title')) el.setAttribute('title', trimmed);
        el.setAttribute('data-ao3tm-bilingual', '1');
      }
    }
    return true;
  }

  function translateAttributes(el, bilingual) {
    if (!el.attributes) return false;
    let changed = false;
    const translateAttrValue = function (name) {
      const value = el.getAttribute(name);
      if (!value) return;
      const trimmed = value.trim();
      const next = lookup(trimmed);
      if (!next || next === trimmed) return;
      el.setAttribute(name, next);
      changed = true;
    };

    ATTRS.forEach(translateAttrValue);

    // 搜索框/评论框那种 <input type="submit" value="Search">：
    // value 是界面上看得见的按钮文字，必须翻；
    // 但文本输入框的 value 是用户内容，绝不能动，所以按 type 白名单。
    const tag = el.tagName;
    if (tag === 'INPUT' && BUTTON_INPUT_TYPES[String(el.getAttribute('type') || 'text').toLowerCase()]) {
      translateAttrValue(VALUE_ATTR);
    } else if (tag === 'BUTTON') {
      translateAttrValue(VALUE_ATTR);
    }

    // AO3 的订阅按钮文字由 JS 从 data-create-value 生成，也一并翻掉
    DATA_VALUE_ATTRS.forEach(translateAttrValue);

    if (changed && bilingual) el.setAttribute('data-ao3tm-bilingual', '1');
    return changed;
  }

  /** 跑一轮翻译；返回改动的节点数 */
  function pass() {
    const settings = currentSettings();
    if (!settings.i18n) return 0;
    const bilingual = settings.i18nBilingual === true;

    let changed = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (shouldSkip(node, bilingual)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (translateTextNode(node, bilingual)) changed += 1;
    });

    // 界面属性（搜索框 placeholder、aria-label 等），不碰站点自己的 title tooltip
    const attrTargets = document.querySelectorAll(
      '[placeholder], [aria-label], [data-create-value], [data-destroy-value], input[type="submit"], input[type="button"], input[type="reset"]'
    );
    Array.prototype.forEach.call(attrTargets, function (el) {
      if (shouldSkipAttr(el)) return;
      if (translateAttributes(el, bilingual)) changed += 1;
    });

    return changed;
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      if (running) return;
      running = true;
      try {
        pass();
      } catch (err) {
        console.error('[AO3 标签管家] 汉化出错', err);
      } finally {
        running = false;
      }
    }, 120);
  }

  function start() {
    schedule();
    if (observer) return;
    try {
      observer = new MutationObserver(function (mutations) {
        const relevant = mutations.some(function (m) {
          return m.addedNodes && m.addedNodes.length;
        });
        if (relevant) schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (err) {
      /* ignore */
    }
  }

  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.i18n = {
    start: start,
    stop: stop,
    pass: pass,
    schedule: schedule,
    phrases: PHRASES,
    translate: function (text) {
      const exact = lookup(text);
      return exact || applyPatterns(text);
    },
    /** 测试用：长句里的固定短语替换 */
    translateInline: translateInlinePhrases,
    /** 测试用：分段翻译 */
    translateCompoundText: translateCompound,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
