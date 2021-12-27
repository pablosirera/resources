import { promises as fs } from 'fs'
import { Client } from "@notionhq/client"
import { README_TAGS } from './constants.js'

import dotenv from 'dotenv'
dotenv.config()

const { DATABASE_ID, NOTION_SECRET_KEY } = process.env

const generateResourcesHTML = (resources) => {
  return resources
  .map(resource => {
    const { name, links } = resource
    // arreglar los links vacios
    console.log(links)
    const link = links.length ? links[0] : {}
    return `
  <p>${ name }</p>
  <li>
    <a href="${ link.url }">${ link.caption }</a>
  </li>
    `
  }).join('')
}

(async () => {
  const databaseId = DATABASE_ID
  const notionKey = NOTION_SECRET_KEY

  const notion = new Client({ auth: notionKey })
  // recuperar todas las páginas de la tabla
  const { results } = await notion.databases.query({
    database_id: databaseId,
  })

  // console.log('pages', results)

  const resources = []

  for (const page of results) {
    const blocks = await notion.blocks.children.list({
      block_id: page.id
    })

    // añadir también a los bookmarks los type link_preview
    const bookmarks = blocks.results.filter(p => p.type === 'bookmark')
    const links = bookmarks.map(block => {
      const captionText = block.bookmark.caption.length ? block.bookmark.caption[0].plain_text : 'Name Test'
      return {
        caption: captionText,
        url: block.bookmark.url
      }
    })


    resources.push({
      tags: page.properties.Tags[page.properties.Tags.type],
      name: page.properties.Name.title[0].plain_text,
      id: page.id,
      cover: page.cover[page.cover.type],
      icon: page.icon[page.icon.type],
      links
    })
  }

  // console.log('resources', resources)

  const allResources = generateResourcesHTML(resources)
  console.log('allResources', allResources)

  const template = await fs.readFile('./app/README.md.tpl', { encoding: 'utf-8' })
  const newMarkdown = template.replace(README_TAGS.RESOURCES, allResources)

  await fs.writeFile('README.md', newMarkdown)
})()
