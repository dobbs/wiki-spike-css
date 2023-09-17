import {Runtime, Inspector, Library} from 'https://cdn.jsdelivr.net/npm/@observablehq/runtime@5.8.2/+esm'
window.addEventListener("load", async () => {
  const wiki = {}

  // document.addEventListener('dragstart', event => event.preventDefault())
  // document.addEventListener('dragover', event => event.preventDefault())
  // document.addEventListener('drop', async function drop(event) {
  //   event.preventDefault()
  //   const {files, items, types} = (event.dataTransfer||{})
  //   wiki.addPanel(ghost('Drop Inspector', [{
  //     type:'unknown',
  //     text:'',
  //     event,
  //     files,
  //     items,
  //     types
  //   }]))
  // })
  // document.addEventListener('paste', async function paste(event) {
  //   event.preventDefault()
  //   const {clipboardData} = event
  //   const {files, items, types} = clipboardData
  //   wiki.addPanel(ghost('Paste Inspector', [{
  //     type:'unknown',
  //     text:'',
  //     event,
  //     files,
  //     items,
  //     types
  //   }]))
  // })

  document.querySelector('footer form').addEventListener('submit', async event => {
    event.preventDefault()
    const article = event.target.closest('article')
    const keepLineup = true
    if (event.submitter.name == 'menu') {
      event.stopPropagation()
      event.stopImmediatePropagation()
      wiki.addPanel(
        wiki.ghost('Explore Code', [{type:'editor', text:'almost blank'}]),
        article,
        keepLineup
      )
      return
    }
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
    wiki.addPanel(panel, article, keepLineup)
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
    modules: [],
    plugins: [
      {
        type: 'unknown',
        deps: ['html'],
        fn: (item, html) => {
          const div = document.createElement('div')
          div.classList.add('item', 'unknown')
          const inspector = new Inspector(div)
          inspector.fulfilled(item)
          div.prepend(html`<p><em>Unknown type:</em> ${item.type}`)
          return div
        }
      },
      {
        type: 'editor',
        deps: ['html'],
        fn: (item, html) => {
          const editor = html`
          <div>
            <button>Show Preview</button>
            <select>
              ${wiki.plugins.map(p => html`<option value="${p.type}">${p.type}</option>`)}
            </select>
            <textarea rows="12" style="width:100%;">${item.text}</textarea>
          </div>`
          editor.dataset.id = `item${item.id}`
          editor.value = {
            id: `item${wiki.randomId()}`,
            type: wiki.plugins[0].type,
            text: item.text
          }
          editor.querySelector('select').addEventListener('change', event => {
            editor.value = {...editor.value, type: event.target.value}
            editor.dispatchEvent(new Event('input'))
          })
          editor.querySelector('textarea').addEventListener('input', event => {
            editor.value = {...editor.value, text: event.currentTarget.value}
          })
          editor.querySelector('button').addEventListener('click', event => {
            const article = event.target.closest('article')
            const keepLineup = event.shiftKey
            const panelId = article.getAttribute('id')
            const panel = wiki.ghost('Preview', [{
              ...editor.value,
              observe: {panelId, itemId: `item${item.id}`}
            }])
            //TODO viewer is not the right name
            panel.notebook = 'viewer'
            wiki.addPanel(panel, article, keepLineup)
          })
          return editor
        }
      },
      {
        type: 'paragraph',
        deps: ['html', 'linked', 'annotateLinks'],
        fn: (item, html, linked, annotateLinks) => annotateLinks(html`<p>${linked(item.text)}`)
      },
      {
        type: 'html',
        deps: ['html', 'linked', 'annotateLinks'],
        fn: (item, html, linked, annotateLinks) => annotateLinks(html`${linked(item.text)}`)
      },
      {
        type: 'markdown',
        deps: ['md', 'linked', 'annotateLinks'],
        fn: (item, md, linked, annotateLinks) => annotateLinks(md`${linked(item.text)}`)
      },
      {
        type: 'reference',
        deps: ['html', 'linked', 'annotateLinks'],
        fn: (item, html, linked, annotateLinks) => {
          const {site, slug, title, text} = item
          const flag = `//${site}/favicon.png`
          const p = annotateLinks(html`
          <p><img class="remote" src="${flag}">
            <a class="internal" data-title="${title}"
               href="//${site}/${slug}.html">${title}</a> - ${linked(text)}`)

          p.querySelector('a[data-title]').addEventListener('click', async (event) => {
            event.preventDefault()
            const article = event.target.closest('article')
            const keepLineup = event.shiftKey
            try {
              const res = await fetch(`//${site}/${slug}.json`)
              let page =  await res.json()
              wiki.addPanel({id: randomId(), flag, page}, article, keepLineup)
            } catch(error) {
              wiki.addPanel(ghost(title, [{
                type: 'unknown',
                text: 'create this page'
              }]), article, keepLineup)
            }
          })
          return p
        }
      },
      {
        type: 'pagefold',
        deps: ['html'],
        fn: (item, html) => html`<hr class="pagefold" data-content="${item.text}">`
      }
    ],
    addPanel(panel, article, keepLineup=false) {
      if (!!keepLineup == false) {
        const mainEl = document.querySelector('main')
        while (mainEl.lastChild && mainEl.lastChild.firstChild != article) {
          wiki.lineup.pop()
          wiki.modules.pop()
          mainEl.lastChild.remove()
        }
      }
        wiki.lineup.push(panel)
        const pragmas = panel.page.story.filter(item => item.text.startsWith('►'))
        if(pragmas.length) {
          console.log({pragmas:pragmas.map(item=>item.text)})
        }
        const module = panelModule(wiki.runtime, panel)
        wiki.modules.push(module)
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

  const notebooks = [
    {
      notebook: 'page',
      fn: panelAdapter
    },
    {
      notebook: 'viewer',
      fn({id, flag, page: {title, story=[], journal=[]}}) {
        return function define(runtime, observer) {
          const main = runtime.module()
          // TODO main.variable(observer('twins')).define(/* ... */)

          const {panelId, itemId} = story[0].observe
          const idx = wiki.lineup.findIndex(p => `panel${p.id}` == panelId)
          main.import(itemId, 'item', wiki.modules[idx])
          main.variable().define(
            'plugin',
            ['item'],
            (item) => wiki.plugins.find(({type}) => type == item.type)
          )

          // initialize preview with an empty div so it exists before
          // we have to redefine it when the author changes the editor
          main.variable().define('preview', ['html'], html => html`<div>`)
          // anonymous variable subscribes to changes in 'plugin' and
          // redefines 'preview' accordingly
          main.variable(true).define(
            ['plugin'],
            async plugin => {
              main.redefine('preview', ['item', ...plugin.deps], plugin.fn)
            }
          )

          main.variable().define('width', '490px')
          main.variable().define('title', title)
          main.variable().define('flag', flag)
          main.variable().define('panelId', `panel${id}`)

          // TODO for(let edit of journal) {/*...*/}
          main.variable(observer('panel')).define(
            'panel',
            ['html', 'width', 'title', 'flag', 'panelId', 'preview'],
            (html, width, title, flag, panelId, preview) => html`
            <article id="${panelId}">
            <div class=twins></div>
            <header><h1><img src="${flag}"> ${title}</h1></header>
            ${preview}
            <footer></footer>
            </article>`
          )
        }
      }
    }
  ]

  function panelModule(runtime, panel) {
    const {notebook='page'} = panel
    const adapter = notebooks.find(nb => nb.notebook == notebook).fn
    return runtime.module(
      adapter(panel),
      name => {
        if (name == 'panel') {
          return Inspector.into('main')()
        }
        return null
      }
    )
  }

  window.wiki = wiki
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
    main.variable().define('width', '490px')
    main.variable().define('title', title)
    main.variable().define('flag', flag)
    main.variable().define('panelId', `panel${id}`)
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
      const itemId = `item${item.id}`
      main.variable().define(`boot${item.id}`, () => item)
      main.variable().define(`viewof ${itemId}`, [`boot${item.id}`, ...plugin.deps], plugin.fn)
      main.variable()
        .define(itemId, ['Generators', `viewof ${itemId}`], (G, el) => G.input(el))
    }
    const deps = ['html', 'title', 'flag', 'panelId', 'width',
                  ...story.map(item => `viewof item${item.id}`)]
    main.variable(observer('panel'))
      .define('panel', deps, (html, title, flag, panelId, width, ...story) => {
        return html`
          <article id="${panelId}">
          <div class=twins></div>
          <header><h1><img src="${flag}"> ${title}</h1></header>
          ${story}
          <footer></footer>
          </article>`
      })
    // TODO for(let edit of journal) {/*...*/}
  }
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
