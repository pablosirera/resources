import { promises as fs } from 'fs'
import { Client } from "@notionhq/client"
import { README_TAGS } from './constants.js'

import dotenv from 'dotenv'
dotenv.config()

const { DATABASE_ID, NOTION_SECRET_KEY } = process.env

const generateCategoriesHTML = (resources) => {
  const list = resources.map(resource => {
    const { name, id, icon } = resource
    if (icon) {
      return `<li><a href="#${id}">${icon} ${name}</a></li>`
    }
    return `<li><a href="#${id}">${name}</a></li>`
  })

  return `
  <ul>
    ${list.join('')}
  </ul>
  `
}

const generateResourcesHTML = (resources) => {
  return resources
  .map(resource => {
    const { name, links, icon, id, category } = resource

    if (links) {
      let htmlLinks = ''
      links.forEach(link => {
        htmlLinks = `${htmlLinks}<li><a target="_blank" href="${ link.url }">${ link.caption }</a></li>`
      })

    return `
  <h2 id="${id}">
    ${ `${icon} ${name}` }
  </h2>
  <p>Incluye ${category.join(', ')}</p>
  <ul>
    ${htmlLinks}
  </ul>
  <br>
    `
    }
  }).join('')
}

(async () => {
  const databaseId = DATABASE_ID
  const notionKey = NOTION_SECRET_KEY
  const notion = new Client({ auth: notionKey })

  const { results } = await notion.databases.query({
    database_id: databaseId,
  })

  const resources = []

  for (const page of results) {
    const blocks = await notion.blocks.children.list({
      block_id: page.id
    })

    const bookmarks = blocks.results.filter(p => p.type === 'bookmark' || p.type === 'link_preview')
    const links = bookmarks.map(block => {
      const type = block.type
      const captionText = block[type].caption && block[type].caption.length ? block[type].caption[0].plain_text : block[type].url

      return {
        caption: captionText,
        url: block[type].url
      }
    })

    const resourcesItem = {
      category: page.properties.Tags[page.properties.Tags.type].map(item => item.name),
      name: page.properties.Name.title[0].plain_text,
      id: page.id,
      cover: page.cover[page.cover.type],
      icon: page.icon[page.icon.type],
    }

    if (links.length) {
      resourcesItem.links = links
    }

    resources.push(resourcesItem)
  }

  const allResources = generateResourcesHTML(resources.sort((a, b) => a.name.localeCompare(b.name)))
  const allCategories = generateCategoriesHTML(resources)

  const template = await fs.readFile('./app/README.md.tpl', { encoding: 'utf-8' })
  let newMarkdown = template.replace(README_TAGS.RESOURCES, allResources)
  newMarkdown = newMarkdown.replace(README_TAGS.CATEGORIES, allCategories)

  await fs.writeFile('README.md', newMarkdown)
})()
