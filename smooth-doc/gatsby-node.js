const fs = require('fs')
const path = require('path')
const { createFilePath } = require('gatsby-source-filesystem')
const { getSiteUrl } = require('./src/theme-options')

function createSchemaCustomization({ actions }) {
  const { createTypes } = actions
  const typeDefs = `
    type NavItem {
      title: String!
      url: String!
    }

    type AlgoliaDocSearchMetadata {
      apiKey: String!
      indexName: String!
    }

    type SiteSiteMetadata {
      title: String!
      description: String!
      siteUrl: String!
      author: String
      twitterAccount: String
      githubRepositoryURL: String
      sections: [String!]
      navItems: [NavItem!]
      carbonAdsURL: String
      docSearch: AlgoliaDocSearchMetadata
    }

    type MdxFrontmatter {
      title: String!
      slug: String
      section: String
      order: Int
      redirect: String
    }
  `
  createTypes(typeDefs)
}

function createDirectoryIfNotExists({ reporter }, pathname) {
  if (!fs.existsSync(pathname)) {
    reporter.info(`creating the ${pathname} directory`)
    fs.mkdirSync(pathname)
  }
}

async function onPreBootstrap(options) {
  // Create all required directories
  createDirectoryIfNotExists(options, 'pages')
  createDirectoryIfNotExists(options, 'pages/docs')
  createDirectoryIfNotExists(options, 'images')
}

function onCreateMdxNode({ node, getNode, actions }, options) {
  const { createNodeField } = actions
  const slug = node.frontmatter.slug || createFilePath({ node, getNode })
  const pageType = /\/pages\/docs\//.test(node.fileAbsolutePath)
    ? 'doc'
    : 'page'

  createNodeField({
    name: 'id',
    node,
    value: node.id,
  })

  createNodeField({
    name: 'pageType',
    node,
    value: pageType,
  })

  createNodeField({
    name: 'title',
    node,
    value: node.frontmatter.title,
  })

  createNodeField({
    name: 'description',
    node,
    value: node.frontmatter.description || '',
  })

  createNodeField({
    name: 'slug',
    node,
    value: slug,
  })

  createNodeField({
    name: 'section',
    node,
    value: node.frontmatter.section || '',
  })

  createNodeField({
    name: 'redirect',
    node,
    value: node.frontmatter.redirect || '',
  })

  function getOrderField() {
    if (!Number.isNaN(Number(node.frontmatter.order))) {
      return node.frontmatter.order
    }
    return null
  }

  createNodeField({
    name: 'order',
    node,
    value: getOrderField(),
  })

  const url = new URL(getSiteUrl(options))
  url.pathname = slug

  createNodeField({
    name: 'url',
    node,
    value: url.toString(),
  })

  function getEditLink() {
    const {
      baseDirectory,
      githubDocRepositoryURL,
      githubRepositoryURL,
      githubDefaultBranch = 'master',
    } = options
    const repositoryURL = githubDocRepositoryURL || githubRepositoryURL
    if (!baseDirectory || !repositoryURL) return ''
    const relativePath = node.fileAbsolutePath.replace(baseDirectory, '')
    return `${repositoryURL}/edit/${githubDefaultBranch}${relativePath}`
  }

  createNodeField({
    name: 'editLink',
    node,
    value: getEditLink(),
  })
}

function onCreateNode(...args) {
  if (args[0].node.internal.type === `Mdx`) {
    onCreateMdxNode(...args)
  }
}

async function createPages({ graphql, actions, reporter }) {
  const { createPage, createRedirect } = actions

  const { data, errors } = await graphql(`
    query {
      allMdx {
        edges {
          node {
            id
            fields {
              slug
              pageType
              redirect
            }
          }
        }
      }
    }
  `)

  if (errors) {
    reporter.panicOnBuild(`Error while running GraphQL query.`)
    return
  }

  // Create pages
  const { edges } = data.allMdx
  edges.forEach(({ node }) => {
    if (node.fields.redirect) {
      createRedirect({
        fromPath: node.fields.slug,
        toPath: node.fields.redirect,
        redirectInBrowser: true,
      })
    }

    createPage({
      path: node.fields.slug,
      component: path.resolve(
        __dirname,
        `./src/templates/${node.fields.pageType}.js`,
      ),
      context: {
        id: node.id,
        pageType: node.fields.pageType,
      },
    })
  })
}

module.exports = {
  createSchemaCustomization,
  onPreBootstrap,
  onCreateNode,
  createPages,
}
