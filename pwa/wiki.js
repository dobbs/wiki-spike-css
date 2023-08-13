import {Runtime, Inspector, Library} from 'https://cdn.jsdelivr.net/npm/@observablehq/runtime@5.8.2/+esm'
window.addEventListener("load", async () => {
  const wiki = {}

  document.addEventListener('dragstart', event => event.preventDefault())
  document.addEventListener('dragover', event => event.preventDefault())
  document.addEventListener('drop', async function drop(event) {
    event.preventDefault()
    const {files, items, types} = (event.dataTransfer||{})
    wiki.addPanel(ghost('Drop Inspector', [{
      type:'unknown',
      text:'',
      event,
      files,
      items,
      types
    }]))
  })
  document.addEventListener('paste', async function paste(event) {
    event.preventDefault()
    const {clipboardData} = event
    const {files, items, types} = clipboardData
    wiki.addPanel(ghost('Paste Inspector', [{
      type:'unknown',
      text:'',
      event,
      files,
      items,
      types
    }]))
  })

  document.querySelector('footer form').addEventListener('submit', async event => {
    event.preventDefault()
    const site = await wiki.sitemap(new FormData(event.target).get('domain'))
    const {domain, sitemap} = site
    const panel = ghost(
      domain,
      sitemap
        .sort((left, right) => left.date > right.date ? -1 : 1)
        .map(({synopsis, slug, title, date}) => ({
          type: 'reference',
          site: domain,
          slug,
          title,
          text: synopsis
        })))
    panel.flag = `//${domain}/favicon.png`
    wiki.addPanel(panel)
  })

  const stdlib = new Library()
  const lib = Object.assign({}, stdlib, {
    async linked() {
      return function linked(text) {
        return text
          .replace(/\[\[(.*?)\]\]/g, (_,title) => `<a class="internal" data-title="${title}" href="#">${title}</a>`)
          .replace(/\[(https?:.*?) (.*?)\]/g, (_,url,word) => `<a href="${url.replace(/^https?:/,'')}">${word}</a>`)
      }
    },
    async annotateLinks() {
      return function annotateLinks(el) {
        el.querySelectorAll('a').forEach(a => {
          if (a.classList.contains('internal')) {
            a.onclick = event => {
              let {title} = event.target.dataset.title
              // TODO do the internal link thing
            }
          } else {
            a.setAttribute('target', '_blank')
          }
        })
        return el
      }
    },
    async html() {
      const {default:DOMPurify} = await import('https://cdn.jsdelivr.net/npm/dompurify@3.0.5/+esm')
      const origHtml = await stdlib.html()

      function sanitize(dirty) {
        return DOMPurify.sanitize(dirty, {
          RETURN_DOM: true,
          SANITIZE_DOM: false,
          IN_PLACE: true,
          ADD_TAGS: ['foreignObject', 'feDropShadow']
        });
      }

      return function sanitizedTaggedTemplateLiteral(...args) {
        return sanitize(origHtml(...args))
      }
    }
  })
  Object.assign(wiki, {
    runtime: new Runtime(lib),
    lineup: [],
    plugins: [
      {
        type: 'unknown',
        deps: ['html'],
        fn: item => (html) => {
          const div = document.createElement('div')
          div.classList.add('item', 'unknown')
          const inspector = new Inspector(div)
          inspector.fulfilled(item)
          div.prepend(html`<p><em>Unknown type:</em> ${item.type}`)
          return div
        }
      },
      {
        type: 'paragraph',
        deps: ['html', 'linked', 'annotateLinks'],
        fn: item => (html, linked, annotateLinks) => annotateLinks(html`<p>${linked(item.text)}`)
      },
      {
        type: 'html',
        deps: ['html', 'linked', 'annotateLinks'],
        fn: item => (html, linked, annotateLinks) => annotateLinks(html`${linked(item.text)}`)
      },
      {
        type: 'markdown',
        deps: ['md', 'linked', 'annotateLinks'],
        fn: item => (md, linked, annotateLinks) => annotateLinks(md`${linked(item.text)}`)
      },
      {
        type: 'reference',
        deps: ['html', 'linked', 'annotateLinks'],
        fn: item => (html, linked, annotateLinks) => {
          const {site, slug, title, text} = item
          const flag = `//${site}/favicon.png`
          const p = annotateLinks(html`
          <p><img class="remote" src="${flag}">
            <a class="internal" data-title="${title}"
               href="//${site}/${slug}.html">${title}</a> - ${linked(text)}`)

          p.querySelector('a[data-title]').addEventListener('click', async (event) => {
            event.preventDefault()
            try {
              const res = await fetch(`//${site}/${slug}.json`)
              let page =  await res.json()
              wiki.addPanel({id: randomId(), flag, page})
            } catch(error) {
              wiki.addPanel(ghost(title, [{
                type: 'unknown',
                text: 'create this page'
              }]))
            }
          })
          return p
        }
      },
      {
        type: 'pagefold',
        deps: ['html'],
        fn: item => html => html`<hr class="pagefold" data-content="${item.text}">`
      }
    ],
    addPanel(panel, replaceId=null) {
      if (!replaceId) {
        wiki.lineup.push(panel)
        const pragmas = panel.page.story.filter(item => item.text.startsWith('►'))
        if(pragmas.length) {
          console.log({pragmas:pragmas.map(item=>item.text)})
        }
        const module = panelModule(wiki.runtime, panel)
        /*
          We have coupled the next bit of code to invasive knowledge
          about panelModule(). TODO is there a better way to do this?

          We started this with:

          document.querySelector('main').lastChild.scrollIntoView()

          That scrolled before the new page had been rendered in the
          DOM.

          What we have now works, but it has to know that 'panel' is a
          special variable name, that it updates the DOM as a
          side-effect, and that it specifically adds to 'main'.
        */
        module.value('panel').then(panel =>
          document.querySelector("main > *:last-of-type")
            .scrollIntoView({behavior:'smooth'})
        )
      } else {
        // TODO implement behavior to replace right lineup
      }
    },
    findPage({title, context=[]}) {
      for(let siteMap of context) {
        for(let page of Object.values(siteMap)) {
          if (page.title.toLowerCase() == title.toLowerCase()) {
            return page
          }
        }
      }
      return {}
    },
    ghost,
    randomId,
    sitemap,
    panel
  })

  window.wiki = wiki

  wiki.lineup =
    [
      'Zip',
      'Zippity Doo Dah. Zippity Eh. My, oh my.',
      'Hello, World!',
      'Welcome Visitors'
    ].map(title => ghost(title, [
      {
        text:"This is a paragraph. With an unexpanded [[Internal Link]]"
      },
      {
        type:"markdown",
        text:"This paragraph _has markdown_. [Markdown Link](//wiki.dbbs.co/apparatus.html)\n\n[https://wander.dbbs.co/commonplace-book.html External Link]"
      },
      ...(Array.from({length:Math.round(Math.random()*4)+2}, _ => ({
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
      })))
    ]))
})

function panelAdapter({id, flag, page: {title, story=[], journal=[]}}) {
  // TODO panelAdapter() is not the right name--keep having to ask
  // what this thing does. It is an adapter which adapts a wiki panel
  // into an Observable module definition. But the name on the outside
  // doesn't explain the role within Observable.

  // TODO maybe change flag to site and lookup the flag from the site
  return function define(runtime, observer) {
    const main = runtime.module()
    // TODO main.variable(observer('twins')).define(/* ... */)
    main.variable(observer('title')).define('title', () => title)
    for(let item of story) {
      // Using item.id to name the Observable variables. Not sure this
      // will be useful. Although id collisions are very unlikely,
      // they are not impossible and they will be very confusing to
      // debug. maybe TODO: guarantee uniqueness here
      //
      // Speculate that wiki's look-left pattern can be represented in
      // Observable by using variable.import() in page modules to the
      // right pulling variables from pages modules to their left.
      // https://github.com/observablehq/runtime#variable_import

      // TODO: wrap this function in some way to inject the wiki
      // dependency, or more specifically, the plugins, instead of
      // using a global here
      let plugin = window.wiki.plugins.find(({type}) => type == item.type)
      plugin ||= window.wiki.plugins.find(({type}) => type == 'unknown')
      main.variable(observer(`item${item.id}`))
        .define(`item${item.id}`, plugin.deps, plugin.fn(item))
    }
    const deps = ['html', ...story.map(item => `item${item.id}`)]
    main.variable(observer('panel'))
      .define('panel', deps, (html, ...story) => {
        return html`
          <article id="panel${id}">
          <div class=twins></div>
          <header><h1><img src="${flag}"> ${title}</h1></header>
          ${story}
          <footer></footer>
          </article>`
      })
    // TODO for(let edit of journal) {/*...*/}
  }
}

function panelModule(runtime, panel) {
  return runtime.module(
    panelAdapter(panel),
    name => {
      if (name == 'panel') {
        return Inspector.into('main')()
      }
      return null
    }
  )
}

function randomId() {
  let x = new Uint32Array(2)
  crypto.getRandomValues(x)
  return Array.from(x, i=>i.toString(16)).join('')
}

function ghost(title, story) {
  let page = {title, story: story.map(item => ({
    id: randomId(),
    type: 'paragraph',
    ...item
  }))}
  let journal = [{
    action: 'create',
    item: page,
    date: +(new Date())
  }]
  return {
    id: randomId(),
    flag: './icon-120.png',
    page: {
      ...page,
      journal
    }
  }
}

async function sitemap(domain) {
  try {
    const res = await fetch(`//${domain}/system/sitemap.json`)
    return {
      domain,
      sitemap: await res.json()
    }
  } catch (error) {
    return {error}
  }
}

async function panel(domain, {slug}) {
  try {
    const res = await fetch(`//${domain}/${slug}.json`)
    return {
      id: randomId(),
      flag: `//${domain}/favicon.png`,
      page: await res.json()
    }
  } catch (error) {
    return {error}
  }
}
