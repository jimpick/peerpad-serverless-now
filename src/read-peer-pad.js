const url = require('url')
const PeerBase = require('peer-base')
const IPFSRepo = require('ipfs-repo')
const { MemoryDatastore } = require('interface-datastore')
const remark = require('remark')
const remarkHtml = require('remark-html')
const html = require('nanohtml')
const raw = require('nanohtml/raw')

let title
let content
let error

let invocationCount = 0
let timerCount = 0

if (!process.env.URL) {
  console.error('URL environment variable not set!')
  process.exit(1)
}

const ready = run()

setInterval(() => {
  console.log('Date', new Date(), ++timerCount, title, content && content.length)
}, 1000)

const inlineStylesheet = html`
<style>
body {
  margin: 2rem;
}
.Doc {
  color: #0e1d32;
  line-height: 1.5;
  font-size: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "avenir next", avenir, helvetica, "helvetica neue", ubuntu, roboto, noto, "segoe ui", arial, sans-serif;
}

.Doc h1,
.Doc h2,
.Doc h3,
.Doc h4,
.Doc h5,
.Doc h6 {
  font-weight: normal;
  padding: 0;
  margin: 2.4rem 0 -0.4rem;
}

.Doc h1 {
  font-size: 2.5em;
}
.Doc h2 {
  font-size: 2em;
}
.Doc h3 {
  font-size: 1.5rem;
}
.Doc h4 {
  font-weight: 700;
  font-size: 1.25rem;
}
.Doc h5 {
  font-size: 1rem;
  font-weight: 700;
}
.Doc h6 {
  font-size: 1rem;
  font-weight: 600;
}

.Doc p {
  margin: 1.2rem 0;
}

.Doc a {
  color: #1fccdf;
  text-decoration: none;
}

.Doc a:hover {
  text-decoration: underline;
}

.Doc img {
  max-width: 100%;
  margin: 0.4rem 0;
}

.Doc ul,
.Doc ol {
  margin: 1.2rem 0;
  line-height: 1.8;
  padding-left: 20px;
}

.Doc code {
  border-radius: 3px;
  background-color: rgba(27,31,35,0.05);
  padding: 0.2rem 0.3rem;
  margin: 0 -0.1rem;
  font-size: 85%;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.Doc pre code {
  margin: 1.8rem 0;
  padding: 1rem;
  display: block;
}

.Doc blockquote {
  color: #656464;
  padding: .2rem 1rem;
  margin: 1.2rem 0;
  border-left: .2rem solid #656464;
}

.Doc blockquote p:first-child {
  margin-top: 0.25rem;
}

.Doc blockquote p:last-child {
  margin-bottom: 0.25rem;
}

.Doc table {
  display: block;
  width: 100%;
  overflow: auto;
  margin: 1.8rem 0;
  border-spacing: 0;
  border-collapse: collapse;
}

.Doc table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.Doc table th {
  font-weight: 600;
}

.Doc table th,
.Doc table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.Doc hr {
  margin: 2.4rem 0;
}
</style>
`

module.exports = (req, res) => {
  ready
    .then(() => {
      console.log(req.url)
      if (req.url === '/_stop') {
        res.end('Stopping...')
        setTimeout(() => process.exit(0), 1000)
        return
      }
      if (error) {
        res.end(error)
      } else {
        res.setHeader('X-Peer-Pad-Invocation-Count', `${++invocationCount}`)
        // Give protocol some time to reconnect and sync
        console.log('Waiting 4 seconds', new Date(), timerCount)
        setTimeout(() => {
          console.log('Done waiting', new Date(), timerCount)
          remark()
            .use(remarkHtml)
            .process(content, (err, rendered) => {
              const body = html`
                <html>
                  <head>
                    <title>${title}</title>
                    ${inlineStylesheet}
                  </head>
                  <body class="Doc">
                    ${err || raw(String(rendered))}
                  </body>
                </html>
              `
              res.end(body.toString())
            })
        }, 4000)
      }
    })
    .catch(err => {
      res.end(err)
    })
}


async function run () {
  console.log('PeerPad URL:', process.env.URL)
  const { hash } = url.parse(process.env.URL)
  const [ _, name, publicKey ] = hash.match(/^#\/w\/markdown\/([^\/]+)\/([^-]+)/)

  await fetchPad(name, publicKey)
    .then(() => {  
      console.log('Fetched')
      console.log(`Title: ${title}\n\n${content}\n`)
    })
    .catch(err => {
      console.error(err)
      error = err
    })
}

async function fetchPad (name, publicKey) {
  const app = PeerBase('peer-pad/2', {
    ipfs: {
      repo: new IPFSRepo('ipfs', {
        lock: 'memory',
        storageBackends: {
          root: MemoryDatastore,
          blocks: MemoryDatastore,
          keys: MemoryDatastore,
          datastore: MemoryDatastore
        }
      }),
      swarm: ['/dns4/ws-star1.par.dwebops.pub/tcp/443/wss/p2p-websocket-star'],
      bootstrap: [
        '/dns4/ams-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
        '/dns4/lon-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
        '/dns4/sfo-3.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
        '/dns4/sgp-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
        '/dns4/nyc-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
        '/dns4/nyc-2.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
        '/dns4/node0.preload.ipfs.io/tcp/443/wss/ipfs/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic',
        '/dns4/node1.preload.ipfs.io/tcp/443/wss/ipfs/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6'
      ]
    }
  })

  console.log('Starting...')
  await app.start()

  const keys = await PeerBase.keys.uriDecode(publicKey)
  const collaboration = await app.collaborate(name, 'rga', { keys })
  const titleCollab = await collaboration.sub('title', 'rga')

  const fetchContent = () => new Promise(resolve => {
    content = collaboration.shared.value().join('')
    if (content && content.length > 0) return resolve()
    collaboration.on('state changed', checkContent)

    function checkContent () {
      content = collaboration.shared.value().join('')
      console.log('Content updated, length:', content.length)
      if (content && content.length > 0) resolve()
    }
  })

  const fetchTitle = () => new Promise(resolve => {
    title = titleCollab.shared.value().join('')
    if (title && title.length > 0) return resolve()
    titleCollab.on('state changed', checkTitle)

    function checkTitle () {
      title = titleCollab.shared.value().join('')
      console.log('Title updated:', title)
      if (title && title.length > 0) resolve()
    }
  })

  console.log('Fetching content...')
  await fetchContent()
  console.log('Fetching title...')
  await fetchTitle()
}
