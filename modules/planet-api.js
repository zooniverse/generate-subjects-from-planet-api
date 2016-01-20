var request    = require('request')
var http       = require('http')
var fs         = require('fs')
var jsonFormat = require('json-format')
var async      = require('async')

/* Sequentially download "before" and "after" mosaics */
function fetchBeforeAndAfterMosaicFromAOI (before_url, after_url, bounds, callback){
  async.series([
    async.apply( fetchMosaicFromAOI, bounds, before_url, 'before'),
    async.apply( fetchMosaicFromAOI, bounds, after_url,  'after')
  ], function (error, result){
      if (error) console.error(error);
      console.log('\nCompleted fetching before/after mosaics!');
      callback(result)
  })
}

/* Downloads a GeoTIF mosaic quad */
function fetchMosaicFromAOI (bounds, url, label, callback){

  console.log('Fetching ' + label + ' mosaics intersecting with AOI...');

  var intersects = JSON.stringify({
      "type": "Polygon",
        "coordinates": [bounds]
  })

  var params = { intersects: intersects }

  request({
      url: url,
      qs: params,
      method: "GET",
      headers: {
          "Authorization": "Basic " + new Buffer(process.env.PLANET_API_KEY + ":").toString("base64")
      },
  }, function (error, response, body) {
      if (!error) {
          var data = JSON.parse(body)
          processFeatures(data.features, label, function(result){ callback(null, result); } ) // download images and data
      }
  })
}

/* Figure out what to download from JSON response */
function processFeatures(features, label, callback){
  var task_list = [] // array of function calls
  for(var i in features){
    var url = features[i].properties.links.full // note: different from scenes script
    var basename  = url.split('/')[7]
    var dest      = 'data/' + basename + '_' + label + '.tif'
    var meta_dest = 'data/' + basename + '_' + label + '.json'

    // prepare array of function calls
    task_list.push( async.apply( downloadFile, url, dest ) )

    /* Write Metadata to JSON */
    fs.writeFile(meta_dest, jsonFormat(features[i]), function(err){
      if (err) console.error('Could not save feature data to JSON! ' + err)
    });

  }
  
  /* Download files from list */
  async.parallel(task_list, function (err, result) {
    if (err) console.error(err);
    callback(result)
  });

}

/* Downloads a file at url to dest */
function downloadFile(url, dest, callback){
  var localStream = fs.createWriteStream(dest)
  var out = request({
      url: url,
      method: "GET",
      headers: { "Authorization": "Basic " + new Buffer(process.env.PLANET_API_KEY + ":").toString("base64") }
  });
  out.on('response', function (resp) {
      if (resp.statusCode === 200){
        out.pipe(localStream);
        localStream.on('close', function () {
          console.log('  File ' + dest + ' transfer complete.')
          callback(null, dest) // return path to downloaded file
        });
      }
  })
}

/* Handle module exports */
exports.downloadFile                     = downloadFile
exports.fetchMosaicFromAOI               = fetchMosaicFromAOI
exports.fetchBeforeAndAfterMosaicFromAOI = fetchBeforeAndAfterMosaicFromAOI
