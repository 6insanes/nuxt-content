import { Node as UnistNode } from 'unist'
import type { MarkdownRoot, MarkdownNode, MarkdownOptions } from '../types'

type Node = UnistNode & {
  tagName?: string
  content?: any
  value?: string
  children?: Node[]
  properties: Record<string, any>
  attributes?: Record<string, any>
  fmAttributes?: Record<string, any>
}

/**
 * JSON compiler
 */
export default function (this: any, _options: MarkdownOptions) {
  /**
   * Parses nodes for JSON structure. Attempts to drop
   * unwanted properties.
   */
  function parseAsJSON (node: Node, parent: MarkdownNode[]) {
    /**
     * Element node creates an isolated children array to
     * allow nested elements
     */
    if (node.type === 'element') {
      const childs: Node[] = []

      if (node.tagName === 'li') {
        // unwrap unwanted paragraphs around `<li>` children
        let hasPreviousParagraph = false
        node.children = (node.children as Node[]).flatMap((child) => {
          if (child.tagName === 'p') {
            if (hasPreviousParagraph) {
              // Insert line break before new paragraph
              ;(child.children as Node[]).unshift({
                type: 'element',
                tagName: 'br',
                properties: {}
              })
            }

            hasPreviousParagraph = true
            return child.children
          }
          return child
        }) as Node[]
      }

      /**
       * rename component slots tags name
       */
      if (node.tagName === 'component-slot') {
        node.tagName = 'template'
        node.content = { ...node }
      }

      const filtered: MarkdownNode = {
        type: 'element',
        tag: node.tagName as string,
        props: node.properties,
        children: childs,
        attributes: node.attributes,
        fmAttributes: node.fmAttributes
      }

      // Unwrap contents of the template, saving the root level inside content.
      if (node.tagName === 'template') {
        const children = (node.content as Node).children as Node[]
        const templateContent: any[] = []
        children.forEach(templateNode => parseAsJSON(templateNode, templateContent))
        filtered.content = templateContent
      }

      parent.push(filtered)

      if (node.children) {
        ;(node.children as Node[]).forEach(child => parseAsJSON(child, childs))
      }

      return
    }

    /**
     * Text node pushes to the parent
     */
    if (node.type === 'text') {
      parent.push({
        type: 'text',
        value: node.value as string
      })
      return
    }

    /**
     * Root level nodes push to the original parent
     * children and doesn't create a new node
     */
    if (node.type === 'root') {
      ;(node.children as Node[]).forEach(child => parseAsJSON(child, parent))
    }
  }

  this.Compiler = function (root: Node): MarkdownRoot {
    /**
     * We do not use `map` operation, since each node can be expanded to multiple top level
     * nodes. Instead, we need a array to fill in as many elements inside a single
     * iteration
     */
    const result: any = []
    parseAsJSON(root, result)

    return {
      type: 'root',
      children: result
    }
  }
}