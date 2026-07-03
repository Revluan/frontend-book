import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import { readdirSync } from 'fs'
import { join } from 'path'

const daily30Dir = 'Daily30'

function getDaily30Sidebar() {
  const dirs = readdirSync(daily30Dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse()

  return dirs.map(dir => {
    const files = readdirSync(join(daily30Dir, dir))
      .filter(f => f.endsWith('.md'))
      .map(f => `/${daily30Dir}/${dir}/${f}`)
      .sort()

    // 格式化目录名显示，如 "2026-02" -> "2026年2月"
    const [year, month] = dir.split('-')
    const label = `${year}年${parseInt(month)}月`

    return {
      text: label,
      children: files,
    }
  })
}

export default defineUserConfig({
  lang: 'zh-CN',
  title: '前端学习笔记',
  description: '日常学习记录与知识整理',

  bundler: viteBundler(),

  theme: defaultTheme({
    logo: '/logo.svg',
    
    navbar: [
      { text: '首页', link: '/' },
      {
        text: '基础',
        children: [
          { text: 'HTML', link: '/html/note.md' },
          { text: 'CSS', link: '/css/note.md' },
          { text: 'JavaScript', link: '/js/js.md' },
          { text: 'TypeScript', link: '/js/ts.md' },
        ],
      },
      {
        text: '框架',
        children: [
          { text: 'React', link: '/react/node.md' },
          { text: 'Next.js', link: '/nextjs/Hydration水合.md' },
        ],
      },
      {
        text: '工程化',
        children: [
          { text: 'Webpack', link: '/webpack_vite/webpack.md' },
          { text: 'Vite', link: '/webpack_vite/vite.md' },
          { text: 'Package.json', link: '/packagejson/note.md' },
        ],
      },
      {
        text: '其他',
        children: [
          { text: '网络', link: '/network/note.md' },
          { text: '性能优化', link: '/performance/note.md' },
          { text: 'AI', link: '/ai/note.md' },
          { text: '手写题', link: '/handwrite/node.md' },
        ],
      },
      { text: '每日30分钟', link: getDaily30Sidebar()[0]?.children?.[0] || '/Daily30/2026-02/0209.md' },
      { text: '面试', link: '/interview/2025-1-13仙工智能.md' },
    ],

    sidebar: {
      '/js/': [
        {
          text: 'JavaScript',
          children: [
            '/js/js.md',
            '/js/ts.md',
            '/js/node.md',
          ],
        },
      ],
      '/react/': [
        {
          text: 'React',
          children: [
            '/react/node.md',
          ],
        },
      ],
      '/webpack_vite/': [
        {
          text: '构建工具',
          children: [
            '/webpack_vite/webpack.md',
            '/webpack_vite/vite.md',
            '/webpack_vite/note.md',
          ],
        },
      ],
      '/Daily30/': getDaily30Sidebar(),
      '/resume/': [
        {
          text: '简历相关',
          children: [
            '/resume/node.md',
            '/resume/problem.md',
          ],
        },
      ],
    },

    // 页面编辑链接
    editLink: false,
    
    // 最后更新时间
    lastUpdated: true,
    lastUpdatedText: '最后更新',

    // 贡献者
    contributors: false,

    // 搜索
    search: true,

    // 外观切换
    colorModeSwitch: true,
  }),

  // 为手机端优化
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ['link', { rel: 'apple-touch-icon', href: '/logo.svg' }],
  ],
})

