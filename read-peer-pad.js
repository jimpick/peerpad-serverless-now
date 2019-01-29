const PeerBase = require('peer-base')
const IPFSRepo = require('ipfs-repo')
const { MemoryDatastore } = require('interface-datastore')

module.exports = (req, res) {
	res.end('PeerPad ' + req.url)
}

async function run () {
  const { hash } = new URL(url)
  const [ _, name, publicKey ] = hash.match(/^#\/w\/markdown\/([^\/]+)\/([^-]+)/)

  try {
    const [ title, content ] = await fetchPad(name, publicKey)
    console.log(`Title: ${title}\n\n${content}\n`)
    process.exit(0)
  } catch (e) {
    console.error('Exception:', e)
    process.exit(1)
  }
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
    let content = collaboration.shared.value().join('')
    if (content && content.length > 0) return resolve(content)
    collaboration.on('state changed', checkContent)

    function checkContent () {
      content = collaboration.shared.value().join('')
      if (content && content.length > 0) {
        collaboration.off('state changed', checkContent)
        resolve(content)
      }
    }
  })

  const fetchTitle = () => new Promise(resolve => {
    let title = titleCollab.shared.value().join('')
    if (title && title.length > 0) return resolve(title)
    titleCollab.on('state changed', checkTitle)

    function checkTitle () {
      title = titleCollab.shared.value().join('')
      if (title && title.length > 0) {
        titleCollab.off('state changed', checkTitle)
        resolve(title)
      }
    }
  })

  console.log('Fetching content...')
  const content = await fetchContent()
  console.log('Fetching title...')
  const title = await fetchTitle()

  return [title, content]
}
