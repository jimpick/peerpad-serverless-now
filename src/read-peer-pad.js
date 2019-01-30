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

if (!process.env.URL) {
  console.error('URL environment variable not set!')
  process.exit(1)
}

const ready = run()

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
        remark()
          .use(remarkHtml)
          .process(content, (err, rendered) => {
            const body = html`
              <html>
                <head>
                  <title>${title}</title>
                </head>
                <body>
                  ${err || raw(String(rendered))}
                </body>
              </html>
            `
            res.end(body.toString())
          })
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
