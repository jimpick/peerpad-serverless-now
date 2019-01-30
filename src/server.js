var http = require('http')

http.createServer(require('./read-peer-pad'))
  .listen(8080)
