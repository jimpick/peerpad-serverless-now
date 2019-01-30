const PeerBase = require('peer-base')
const IPFSRepo = require('ipfs-repo')
const { MemoryDatastore } = require('interface-datastore')
const url = require('url')

let title
let content
let error

let invocationCount = 0

const ready = run()

module.exports = (req, res) => {
  ready
    .then(() => {
      if (error) {
        res.end(error)
      } else {
        res.end(`Invocation: ${++invocationCount}\n\nTitle: ${title}\n\n${content}\n`)
      }
    })
    .catch(err => {
      res.end(err)
    })
}


async function run () {
  console.log('Running')
  const myURL = 'https://dev.peerpad.net/#/w/markdown/6nrKDJZcmREaq5avnr5pRZtoW8iaP3VdcdUQmWLQ9FJp/4XTTM8dzYTy4YvupugJ4cevorUjEnNtMUkC3B7NbzPiJTYDov-K3TgUVWssAaWNHS1NYEm8q12CuLymNJE2kCDvv6nEbSoW9Au161qPe4wUXXQD9syQbhkuM6b8LK77JsdBdN2LtvxjC21qnRtNGRrir8fixWpEXgxxhLkQQUGMLQwWMW2pJuK78Fr'

  const { hash } = url.parse(myURL)
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
      if (title && title.length > 0)  resolve()
    }
  })

  console.log('Fetching content...')
  await fetchContent()
  console.log('Fetching title...')
  await fetchTitle()
}
