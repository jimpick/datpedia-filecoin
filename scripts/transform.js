#!/usr/bin/env node

const fs = require('fs')
const mkdirpSync = require('mkdirp').sync
const dataUriSync = require('datauri').sync

const {rewriteImageUrls, rewriteLinks} = require('./relinker.js')

if (process.argv.length !== 3) {
  console.log('Usage: ./scripts/transform.js <name>')
  process.exit()
}

main(process.argv[2])

function main (name) {
  const dst = 'transform/' + name
  const dstA = dst + '/A'
  mkdirpSync(dstA)

  console.log('listing articles')

  const articles = fs.readdirSync('extract/' + name + '/A/')
    .filter(s => s.endsWith('.html'))
    .map(s => s.substring(0, s.length - '.html'.length))

  articles.forEach(article => transferArticle(name, article, dstA))
}

function transferArticle (dumpName, name, dst) {
  const filename = 'extract/' + dumpName + '/A/' + name + '.html'

  if (!fs.existsSync(filename)) {
    console.log('not found, skipping: ' + filename)
    return
  }

  console.log('transferring %s', name)

  const html = fs.readFileSync(filename, 'utf8')
  const newHtml = transformHtml(html, dumpName, name)
  fs.writeFileSync(dst + '/' + name + '.html', newHtml)
}

function transformHtml (html, dumpName, pageUrlName) {
  const lines = html.split(/\n/g).map(s => s.trim())

  let foundStylesheet = false
  const newLines = lines
    .filter(line => !line.includes('<script'))
    .map(line => {
      if (line.startsWith('<link rel="stylesheet"')) {
        if (foundStylesheet) {
          console.error('found two stylesheets, ignoring second')
          return ''
        }
        foundStylesheet = true
        return '<link rel="stylesheet" href="./style.css">'
      } else if (line.startsWith('<body ')) {
        return '<body class="mw-body mw-body-content mediawiki">'
      } else {
        return line
      }
    })

  let newHtml = newLines.join('\n')
  newHtml = rewriteImageUrls(newHtml, url => transformImageUrl(url, dumpName))
  newHtml = rewriteLinks(newHtml, url => transformLink(url, pageUrlName))
  return newHtml
}

// Transforms image urls to data:// URIs
function transformImageUrl (url, dumpName) {
  if (!url.startsWith('../I/m')) return url

  const imagePath = decodeURIComponent(url.substring(3))
  const dataURI = dataUriSync('extract/' + dumpName + '/' + imagePath)
  return dataURI
}

function transformLink (url, pageUrlName) {
  // Leave external links alone
  if (url === '' || url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('#')) {
    // Cite notes, etc. Rewrite "#cite_note-1" to '#Hypertext#cite_note-1'
    return '#' + pageUrlName + url
  }
  if (!url.endsWith('.html')) {
    console.log('skipping non-standard link: ' + url)
    return url
  }
  // Wiki links. Rewrite 'Anarchism.html' to '#Anarchism'
  return '#' + url.substring(0, url.length - '.html'.length)
}
