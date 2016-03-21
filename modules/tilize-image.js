var os             = require('os')
var fs             = require('fs')
var im             = require('imagemagick')
var path           = require('path')
var gdal           = require('gdal')
var async          = require('async')
var imgMeta        = require('./image-meta')
var geoCoords      = require('./geo-coords')

/**
 * Splits an image into tiles
 * @param  {String}   filename input image
 * @param  {Number}   tileSize Square size for the resultant tiles (in pixels)
 * @param  {Number}   overlap  Amount by which to overlap tiles in x and y (in pixels)
 * @param  {Function} callback
 */
function tilizeImage (filename, tileSize, overlap, callback){
  var tile_wid = tileSize;
  var tile_hei = tileSize;
  var step_x = 4 * tile_wid - overlap;
  var step_y = 4 * tile_hei - overlap;

  var basename = path.basename(filename).split('.')[0]
  var dirname  = path.dirname(filename)
  var ds = gdal.open(filename)
  var metadata = geoCoords.getMetadata(ds)
  var size = metadata.size

  // Tile creator
  var create_tile_task = function (task, done) {
    var row = task.row
    var col = task.col
    var offset_x = task.offset_x
    var offset_y = task.offset_y

    // crop current tile
    var outfilename = dirname + '/' + basename + '_' + row + '_' + col + '.jpeg'
    var crop_option = tile_wid + 'x' + tile_hei + '+' + offset_x + '+' + offset_y
    var extent_option = tile_wid + 'x' + tile_hei

    /* Convert corner and center pixel coordinates to geo */
    var coords = {
      upper_left   : geoCoords.pxToWgs84(ds, offset_x,                offset_y),
      upper_right  : geoCoords.pxToWgs84(ds, offset_x + tile_wid,     offset_y),
      bottom_right : geoCoords.pxToWgs84(ds, offset_x + tile_wid,     offset_y + tile_hei),
      bottom_left  : geoCoords.pxToWgs84(ds, offset_x,                offset_y + tile_hei),
      center       : geoCoords.pxToWgs84(ds, offset_x + tile_wid / 2, offset_y + tile_hei / 2)
    }

    // Should we -normalize each tile?
    // PRO: Ensures contrast is stretched if images are too dark or washed out
    // CON: May take longer to process?
    im.convert([ filename + '[0]', '-crop', crop_option, '-background', 'black', '-normalize', '-extent', extent_option, '-gravity', 'center', '-compose', 'Copy', '+repage', outfilename ], function (err, stdout) {
      if (err) return done(err)
      imgMeta.write(outfilename, '-userComment', coords, done)  // write coordinates to tile image metadata
    })
  }

  // Init task queue
  var concurrency = os.cpus().length
  var queue = async.queue(create_tile_task, concurrency)

  // Completion callback
  queue.drain = function (error) {
    console.log('  Finished tilizing mosaic: ' + filename);
    callback(error, files)
  }

  // Push tile tasks into queue
  var files = [];
  for( var offset_x=0, row=0; offset_x<=size.x; offset_x+=step_x, row+=1) {
    for( var offset_y=0, col=0; offset_y<=size.y; offset_y+=step_y, col+=1) {
      queue.push({
        row: row,
        col: col,
        offset_x: offset_x,
        offset_y: offset_y
      }, function (err, file) {
        files.push(file);
      })
    }
  } // end outer for loop
}


module.exports = {
  tilize: tilizeImage
};
