export interface ArticlePreview {
  id: string;
  title: string;
  description: string;
  pubDate: Date;
  category: string;
  href?: string;
}

// 仅用于没有正式文章时预览首页布局，不作为内容集合中的已发布文章。
export const articlePreviews: ArticlePreview[] = [
  {
    id: 'building-a-personal-blog',
    title: '使用 Astro 搭建我的个人博客',
    description: '从首页设计到文章展示，记录搭建个人博客的过程，以及一些技术选择背后的思考。希望这个小小的空间，能让写作和分享成为一种习惯。',
    pubDate: new Date('2026-10-08T00:00:00Z'),
    category: '前端开发',
  },
  {
    id: 'typescript-in-practice',
    title: '让 TypeScript 帮我写出更清晰的代码',
    description: '类型不仅用于发现错误，也能帮助表达数据的含义。通过几个日常开发中的例子，聊聊如何让类型定义更简单、更容易维护。',
    pubDate: new Date('2026-10-06T00:00:00Z'),
    category: '编程笔记',
  },
  {
    id: 'small-agent-experiments',
    title: '从一个小任务开始，探索 AI Agent',
    description: '把一个具体问题拆成步骤，再让工具参与其中。这篇笔记记录一次小型实验，以及对任务边界、上下文和结果验证的思考。',
    pubDate: new Date('2026-10-04T00:00:00Z'),
    category: 'AI 探索',
  },
  {
    id: 'designing-for-reading',
    title: '留白、字体与节奏：让博客更适合阅读',
    description: '一个好读的页面，往往来自许多微小的决定。整理关于文字层级、内容宽度和段落间距的观察，尝试让内容自然成为页面的中心。',
    pubDate: new Date('2026-09-29T00:00:00Z'),
    category: '设计思考',
  },
  {
    id: 'keeping-learning-notes',
    title: '把学习过程写下来',
    description: '有些问题是在动笔之后才真正想清楚的。记录那些值得回顾的尝试、困惑与收获，让零散的知识慢慢连接起来。',
    pubDate: new Date('2026-09-24T00:00:00Z'),
    category: '随笔',
  },
];
