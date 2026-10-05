/* 覆盖测试用的"界面文案样本"：[英文原文, 期望译文]
   这些都是官方 locale 里的界面文案（非用户内容），按 AO3 真实结构渲染后验证。 */
module.exports = [
  // 发布 / 导入作品页
  ['Post to Collections / Challenges', '发布到合集 / 挑战'],
  ['Choose Not To Use Archive Warnings', '选择不使用站内警告'],
  ['Post without previewing.', '发布前不预览。'],
  ['Notes at the beginning', '开头注释'],
  ['Who can comment on this work?', '谁可以评论这篇作品？'],
  // 搜索表单（作品 / 用户 / 书签）
  ['Search Results', '搜索结果'],
  ['Edit Your Search', '编辑搜索条件'],
  ['Work Info', '作品信息'],
  ['Work Stats', '作品统计'],
  ['Completion status', '完成状态'],
  ['All works', '全部作品'],
  ['Complete works only', '仅完结作品'],
  ['Include crossovers', '包含跨界联动'],
  ['Search all fields', '搜索所有字段'],
  ['Name', '名称'],
  ['Bookmarker\'s tags', '收藏者的标签'],
  ['With notes', '含注释'],
  ['Date Bookmarked', '收藏日期'],
  ['Sort by', '排序方式'],
  ['Best Match', '最佳匹配'],
  ['Newest first', '最新在前'],
  // 书签筛选侧栏
  ['Ratings', '分级'],
  ['Other work tags to exclude', '要排除的其他作品标签'],
  ['More Options', '更多选项'],
  ['Bookmark types', '收藏类型'],
  ['Recs only', '仅推荐'],
  ['Only bookmarks with notes', '仅含有注释的书签'],
  ['List of Bookmarks', '书签列表'],
  // 浏览历史 / 收件箱 / 任务 / 礼物
  ['Clear Entire History', '清空全部浏览历史'],
  ['Delete from History', '从浏览历史中删除'],
  ['Filter by read', '按已读状态筛选'],
  ['Show without replies', '显示未回复的'],
  ['My Assignments', '我的任务'],
  ['Unposted Assignments', '未发布的任务'],
  ['Accepted Gifts', '已接收的礼物'],
  ['Refused Gifts', '已拒绝的礼物'],
  ['Unfulfilled Claims', '未完成的领取'],
  // 个人主页 / 帮助
  ['Dismiss permanently', '不再提示'],
  ['My Profile', '我的资料'],
  ['Change your account settings', '修改账号设置'],
  ['Start typing for suggestions!', '开始输入以获得建议！'],
  // 举报 / 反馈表单
  ['Your email (required)', '你的邮箱（必填）'],
  ['Send to Abuse Team', '发送给滥用处理团队'],
  ['Contact Information', '联系方式'],
  ['Send Your Feedback', '发送你的反馈'],
  // 符号说明 / 注册
  ['Symbols we use on the Archive', '本站使用的符号'],
  ['Content rating', '内容分级'],
  ['Content warnings', '内容警告'],
  ['Yes, I am at least 13.', '是的，我已满 13 岁。'],
  ['tip: arthur merlin words>1000 sort:hits', '提示：arthur merlin words>1000 sort:hits']
];

/* 作品卡片（blurb）场景：卡片里的"用户数据"不能动，"界面统计"必须翻。
   背景：早先为保护用户数据把整个 li.blurb 跳过，结果连统计和操作按钮也一起挡了。 */
module.exports.BLURB = {
  mustNotChange: {
    title: 'All About Eve',
    fandom: 'Lazy Town',
    tag0: 'Top Park Jongseong | Jay',
    summary: 'The quick brown fox jumps over the lazy dog. Works: 12 is my favourite number.'
  },
  mustTranslate: [
    ['Language:', '语言：'],
    ['Words:', '字数：'],
    ['Chapters:', '章节：'],
    ['Comments:', '评论：'],
    ['Kudos:', 'Kudos：'],
    ['Hits:', '点击：']
  ]
};
/* 用户数据样本：渲染在同页的"用户内容"区域，**一个字都不能改**。
   这些是历史上被片段替换/PATTERNS 改坏过的真实形态。 */
module.exports.MUST_NOT_CHANGE = [
  'All About Eve (1)',
  'Lazy Town (17)',
  'Angels (3)',
  'The 100 Series - Kass Morgan (671)',
  '100 Cupboards Series - N. D. Wilson (8)',
  '1-800-WHERE-R-U Series - Meg Cabot (16)',
  'Top Park Jongseong | Jay',
  'Bottom Park Sunghoon (ENHYPEN)',
  'By Choice, by Fate, or Neither',
  'I write fluffy things and I like tea. Works: 12 is my favourite number.',
  'Fri, 02 Oct 2026 07:14PM UTC'
];
