/* adapted from
 * https://github.com/naturalatlas/node-gdal/blob/master/examples/gdalinfo.js
 */
var gdal       = require('gdal')
var util       = require('util')
var jsonFormat = require('json-format')
var fs         = require('fs')

var filename = process.argv[2]
if (!filename) {
	console.error('Filename must be provided')
	process.exit(1)
}

var ds = gdal.open(filename)

var driver = ds.driver;
var driver_metadata = driver.getMetadata();
if (driver_metadata['DCAP_RASTER'] !== 'YES') {
	console.error('Source file is not a raster')
	process.exit(1);
}

// raster size
var size = ds.rasterSize;

// geotransform
var geotransform = ds.geoTransform;

// corners
var corners = {
	'Upper Left  ' : {x: 0, y: 0},
	'Upper Right ' : {x: size.x, y: 0},
	'Bottom Right' : {x: size.x, y: size.y},
	'Bottom Left ' : {x: 0, y: size.y},
	'Center      ' : {x: size.x / 2, y: size.y / 2}
};

var wgs84 = gdal.SpatialReference.fromEPSG(4326)
var coord_transform = new gdal.CoordinateTransformation(ds.srs, wgs84)

console.log('Corner Coordinates:')
var corner_names = Object.keys(corners)
corner_names.forEach(function(corner_name) {
	// convert pixel x,y to the coordinate system of the raster
	// then transform it to WGS84
	var corner      = corners[corner_name]
	var pt_orig     = {
		x: geotransform[0] + corner.x * geotransform[1] + corner.y * geotransform[2],
		y: geotransform[3] + corner.x * geotransform[4] + corner.y * geotransform[5]
	};
	var pt_wgs84    = coord_transform.transformPoint(pt_orig)

	var lat_dms = gdal.decToDMS(pt_wgs84.y, 'Lat')
	var lon_dms = gdal.decToDMS(pt_wgs84.x, 'Long')
	var dd = dmsToDd( lat_dms, lon_dms ) // convert to decimal degrees
	var description = util.format('%s (%s, %s)', corner_name, dd.lat, dd.lon );
	console.log(description)

});

// convert to decimal degrees
function dmsToDd(lat, lon){
	lat = parseFloat( lat.split('d')[0] ) + parseFloat( lat.split('\'')[0].split('d')[1] )/60 + parseFloat( lat.split('\'')[1].split('\"')[0] )/3600
	lon = parseFloat( lon.split('d')[0] ) + parseFloat( lon.split('\'')[0].split('d')[1] )/60 + parseFloat( lon.split('\'')[1].split('\"')[0] )/3600
	return {lat: lat, lon: lon}
}
