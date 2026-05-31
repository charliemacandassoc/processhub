import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ComponentProps } from 'react'

interface Props {
  content: string
  processId: string
}

type ImgProps = ComponentProps<'img'>
type AnchorProps = ComponentProps<'a'>
type CodeProps = ComponentProps<'code'> & { inline?: boolean }

function toYoutubeEmbed(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  return null
}

function toSharepointEmbed(url: string): string | null {
  if (url.includes('sharepoint.com')) {
    return url.replace('/view.aspx', '/embed.aspx')
  }
  return null
}

export function MarkdownRenderer({ content, processId }: Props) {
  const components = {
    img({ src, alt }: ImgProps) {
      if (alt === 'video' && src) {
        const ytEmbed = toYoutubeEmbed(src)
        const spEmbed = toSharepointEmbed(src)
        const embedSrc = ytEmbed ?? spEmbed
        if (embedSrc) {
          return (
            <div className="video-embed">
              <iframe
                src={embedSrc}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Embedded video"
              />
            </div>
          )
        }
      }
      return <img src={src} alt={alt} />
    },

    a({ href, children }: AnchorProps) {
      if (href?.endsWith('.md')) {
        const filename = href.split('/').pop() ?? href
        const downloadUrl = `/api/processes/${processId}/checklists/${filename}`
        return (
          <a href={downloadUrl} download className="btn btn-outline btn-sm download-btn">
            ⬇ {children}
          </a>
        )
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },

    code({ inline, className, children }: CodeProps) {
      const lang = /language-(\w+)/.exec(className ?? '')?.[1]
      if (!inline && lang === 'mermaid') {
        return <MermaidBlock chart={String(children)} />
      }
      return <code className={className}>{children}</code>
    },
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}

function MermaidBlock({ chart }: { chart: string }) {
  // Lazy-load mermaid to avoid bundling it unless needed
  const id = `mermaid-${Math.random().toString(36).slice(2)}`
  return (
    <div
      className="mermaid"
      id={id}
      ref={(el) => {
        if (!el) return
        import('mermaid').then((m) => {
          m.default.initialize({ startOnLoad: false, theme: 'default' })
          m.default.render(id + '-svg', chart).then(({ svg }) => {
            el.innerHTML = svg
          })
        })
      }}
    >
      {chart}
    </div>
  )
}
