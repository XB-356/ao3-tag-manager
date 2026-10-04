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
    'Language': '语言',
    'Rating': '分级',
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
    'Sort direction': '排序方向',
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
    'Low Vision Default': '低视力默认',
    'Snow Blue': '雪蓝',
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
    'Archive of Our Own': 'AO3（Archive of Our Own）',
    // —— 作品页 / 发布与编辑（来自 AO3 官方 locale: works.*）——
    'Associations': '关联作品',
    'This work could have adult content. If you continue, you have agreed that you are willing to see such content.': '这篇作品可能包含成人内容。继续访问即表示你同意查看此类内容。',
    'No, Go Back': '不，返回',
    'Yes, Continue': '是的，继续',
    'Set your preferences now': '现在就去设置偏好',
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
    'Enter Comment': '输入评论',
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
    'choose a fandom': '选择同人圈',
    'This has been deleted, sorry!': '抱歉，此内容已被删除！',
    // —— 首页 / 通用导航（补充）——
    'My Reading History': '浏览历史',
    'Reading History': '浏览历史',
    'Recent': '最近',
    'Read more...': '阅读全文…',
    'Read more…': '阅读全文…',
    'Read more': '阅读全文',
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
    'Statistics': '统计',
    'Drafts': '草稿',
    'Sign-ups': '报名',
    'Assignments': '任务',
    'Claims': '领取',
    'Related Works': '相关作品',
    'Publish': '发布',
    'Publish New': '发布新作品',
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
    'History': '浏览历史',
    'Dashboard': '主页',
    'Manage My Pseuds': '管理我的笔名',
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
    'Date Updated': '更新日期',
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
    'Anonymous': '匿名',
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
    'Post Comment': '发表评论',
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
    'Last': '末页',
    'No results found.': '没有找到结果。',
    'Sorry, we couldn\u2019t find any results for that search.': '抱歉，没有找到符合该搜索的内容。',
    // —— 筛选 / 排序 ——
    'Filters': '筛选',
    'Sort and Filter': '排序与筛选',
    'Sort by': '排序方式',
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
    'Best Match': '最佳匹配',
    'Word Count': '字数',
    'Hits (descending)': '点击数（降序）',
    'Kudos (descending)': 'Kudos（降序）',
    'Comments (descending)': '评论数（降序）',
    'Bookmarks (descending)': '书签数（降序）',
    'Ascending': '升序',
    'Descending': '降序',
    'Other tags': '其它标签',
    'Include': '包含',
    'Exclude': '排除',
    'Only': '仅',
    'Any field': '任意字段',
    'Complete Only': '仅完结',
    'Crossovers': '跨界联动',
    'Single Chapter': '单章',
    'Multi Chapter': '多章',
    'Categories': '类别',
    'F/M': 'F/M',
    'Gen': 'Gen',
    'Teen And Up Audiences': '青少年及以上',
    'General Audiences': '全年龄',
    'Mature': '成人',
    'Explicit': '露骨',
    'Not Rated': '未分级',
    'No Archive Warnings Apply': '无站内警告',
    'Creator Chose Not To Use Archive Warnings': '作者选择不使用站内警告',
    'Major Character Death': '主要角色死亡',
    'Graphic Depictions Of Violence': '暴力描写',
    'Underage': '未成年性行为',
    'Rape/Non-Con': '强奸/非自愿',
    // —— 书签 / 合集 ——
    'Bookmark Tags': '书签标签',
    'Bookmark Notes': '书签注释',
    'Bookmark Type': '书签类型',
    'Rec': '推荐',
    'Private': '私密',
    'Public': '公开',
    'Notes:': '注释：',
    'External Work': '外部作品',
    'Collection': '合集',
    'Bookmarked:': '收藏于：',
    'Bookmarker': '收藏者',
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
    'Or': '或',
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
    // 中文语境下不需要空格，顺手收一下
    [/\s+([，。、：（）])/g, '$1'],
    [/([（])\s+/g, '$1']
  ];

  /** 属性翻译（placeholder / title / value） */
  const ATTRS = ['placeholder', 'title', 'aria-label'];

  /** 绝对不翻译的区域：
   *  - 用户内容：正文、摘要、注释、标签、评论
   *  - 编辑器：可编辑区
   * 注意：input / textarea 属于表单控件，其文字值不会被翻，但 placeholder 属于界面文案，仍要翻。 */
  const KEEP_USER_CONTENT = [
    '#workskin',
    // 用户自己写的内容（正文 / 简介 / 摘要 / 注记 / 评论）
    'blockquote',
    '#main .notes',
    '#main .summary',
    '#main .comment',
    '.comment',
    '.comment-form',
    '.kudos',
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
    '.ao3tm-focus'
  ].join(', ');

  /** 文本节点：用户内容 + 这些标签的文字都跳过 */
  const SKIP_SELECTOR = [KEEP_USER_CONTENT, 'textarea', 'script', 'style', 'code', 'pre'].join(', ');

  /** 这些标签本身没有可翻译的文字节点，跳过以免误伤 */
  const SKIP_TEXT_TAGS = { INPUT: 1, TEXTAREA: 1, SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1 };

  let observer = null;
  let timer = null;
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
    if (el.closest(SKIP_SELECTOR)) return true;
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
    if (el.closest(KEEP_USER_CONTENT)) return true;
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
    return hit ? out : null;
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
    'Not Rated': 1
  };

  function inlinePhrases() {
    if (INLINE_PHRASES) return INLINE_PHRASES;
    INLINE_PHRASES = Object.keys(PHRASES)
      .filter(function (key) {
        if (INLINE_EXCLUDE[key]) return false;
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
    return tidyPunctuation(out);
  }

  function translateTextNode(node, bilingual) {
    if (!node.nodeValue || !/\S/.test(node.nodeValue)) return false;
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed) return false;

    const exact = lookup(trimmed);
    let next = exact;
    if (!next) {
      const patterned = applyPatterns(trimmed);
      if (patterned !== trimmed) next = patterned;
    }
    // 命中前缀后，把剩下的部分也翻掉。
    // AO3 常把一个 <p> 的文字和链接连在同一个文本节点里，
    // 例如 "Hi! … for the first time. For help getting started on AO3, check out some<a>…</a>"，
    // 整段匹配只能命中前半句，剩下半句如果不管就永远留在英文。
    if (next && next !== trimmed) {
      const rest = trimmed.slice(next.length);
      if (rest && /[A-Za-z]{3}/.test(rest) && !looksLikeRichText(rest)) {
        const restTranslated = translateCompound(rest) || translateInlinePhrases(rest);
        if (restTranslated) next = next + restTranslated;
      }
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

    const leading = original.match(/^\s*/)[0];
    const trailing = original.match(/\s*$/)[0];
    const value = leading + next + trailing;
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
    ATTRS.forEach(function (name) {
      const value = el.getAttribute(name);
      if (!value) return;
      const trimmed = value.trim();
      const exact = lookup(trimmed);
      const next = exact;
      if (!next || next === trimmed) return;
      el.setAttribute(name, next);
      if (bilingual) el.setAttribute('data-ao3tm-bilingual', '1');
      changed = true;
    });
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
    const attrTargets = document.querySelectorAll('[placeholder], [aria-label]');
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
