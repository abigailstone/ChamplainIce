
// import filtering, processing, and ui functions
var filters = require('users/astone/champlain:speckleFiltering');
var processing = require('users/astone/champlain:processing');
var uifuncs = require('users/astone/champlain:uifuncs');


/***************************************
 * Base Map & Map Controls
 ***************************************/

// Customize basemap
var basemapgray = [
  {stylers: [{saturation: -100 }]},
  { elementType: 'labels',stylers: [{lightness:40}]},
  {featureType: 'road', elementType: 'geometry', stylers:[{visibility: 'simplified'}]},
  {elementType: 'labels.icon', stylers:[{ visibility:'off'}]},
  {featureType: 'poi', elementType: 'all', stylers:[{visibility:'off'}]}
];

// Set Map controls
Map.setControlVisibility({
  drawingToolsControl: false
})
Map.setOptions('Gray', {'Gray': basemapgray});
Map.setCenter(-73.31, 44.4398, 9);

/***************************************
 * Datasets and Water Mask
 ***************************************/
 
// USGS National Land Cover Database
// for creating a water mask!
var nlcd = ee.Image('USGS/NLCD_RELEASES/2016_REL/2013');

// Create a water mask using the NLCD 
var waterMask = processing.getWaterMask(nlcd).clip(regionRect);

// Get Sentinel 1 imagery
var sentinel1 = ee.ImageCollection("COPERNICUS/S1_GRD")
            .filterBounds(regionRect)
            // select one polarisation & orbit - picked based on availability 
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
            .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
            .select('VV');

/***************************************
 * Ice-On and Ice-Off Updating
 ***************************************/

var filterYear = function(year){
  // Update image collection with correct year filtering
  var sent1 = sentinel1.filterDate(ee.Date(year+'-11-01').advance(-1, 'year'),
                                   ee.Date(year+'-04-15'))
  
  // Mosaic images by collection date
  var mos = processing.mosaicByDate(sent1)
  
  // despeckle 
  var despeckled = filters.frostFilter(mos, 5, -1);
  
  // Clip the despeckled mosaic by the water mask
  var lakeMosaic = despeckled.map(function(img){
    return img.mask(waterMask).clip(regionRect);
  }).select('smooth');
  
  return lakeMosaic
}


var getIceOn = function(stack, year){
  
  // get filter dates
  var iceOnStart = ee.Date(year+'-11-01').advance(-1, 'year')
  var iceOnEnd = ee.Date(year+'-02-15')
  var iceOnStack = stack.filterDate(iceOnStart, iceOnEnd); 
  
  // Create ice-on image
  var iceOn = ee.Image(processing.getMaxDifference(iceOnStack))
  var onParams = processing.getStretchParams(iceOn, regionRect, ee.Number(98));
  onParams.palette = 'aqua,blue'
  
  // layer & legend
  var iceOnLayer = ui.Map.Layer(iceOn).setVisParams(onParams);
  var iceOnLegend = uifuncs.makeDateColorBar(onParams, 'Date');
  
  Map.layers().set(0, iceOnLayer);
  legend.widgets().set(0, iceOnLegend);
  
  return 0;
}


var getIceOff = function(stack, year){
  //  get fileter dates
  var iceOffStart = ee.Date(year+'-02-15')
  var iceOffEnd = ee.Date(year+'-04-15')
  var iceOffStack = lakeMosaic.filterDate(iceOffStart, iceOffEnd);
  
  // create ice-off image
  var iceOff = ee.Image(processing.getMaxDifference(iceOffStack))
  var offParams = processing.getStretchParams(iceOff, regionRect, ee.Number(98));
  offParams.palette = 'blue,aqua'
  
  // layer & legend
  var iceOffLayer = ui.Map.Layer(iceOff).setVisParams(offParams);
  var iceOffLegend = uifuncs.makeDateColorBar(offParams, 'Date');
  
  Map.layers().set(0, iceOffLayer);
  legend.widgets().set(0, iceOffLegend);
  
}


/***************************************
 * Current Ice Layer 
 ***************************************/

// Get the most recent and put it in an ee.ImageCollection for the Frost function
var topImage = ee.ImageCollection(sentinel1.sort('system:time_start', false).first())
// Frost filter
var topFiltered = filters.frostFilter(topImage, 5, -1)

// Get the most recent image from the smoothed collection
var mostrecent = topFiltered.first().select('smooth');

// Compute histogram for input into Otsu threshold computation
var hist = mostrecent.reduceRegion({
  reducer:ee.Reducer.histogram(),
  scale:30,
  maxPixels:1e9
});

// otsu segmentation
var otsuthresh = processing.otsu(hist);
var ice = ee.Image.constant(0).updateMask(waterMask)
ice = ice.where(mostrecent.lt(otsuthresh), 1)

// Create most recent ice cover layer
var currentIceLayer = ui.Map.Layer(ice).setVisParams({
  min: 0, 
  max: 1,
  palette: 'blue,white'
});


/***************************************
 * UI Elements & Function Calls
 ***************************************/

// Add color bar placeholder
var legend = ui.Panel([ui.Label()],
                      'flow',
                      {position: 'bottom-right'});
Map.add(legend);


// Selector for layer
var layerSelector = ui.Select({
  items: [ //{label:'Current Conditions', value:currentIceLayer},
          {label:'Ice On', value:getIceOn},
          {label:'Ice Off', value:getIceOff}],
  value: getIceOn,
});

 
// Year Selector 
var yearSelector = ui.Select({
  items: ['2018', '2019', '2020'],
  value: '2020'
});

// Get year for ice on/ice off 
var year = yearSelector.getValue()
var lakeMosaic = filterYear(year)


// Panel for ice on/off and year selection
var layerPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {position:'bottom-left', width:'225px'}
});

// add widgets to panel
layerPanel.add(ui.Label('Select a layer to display:'));
layerPanel.add(layerSelector);
layerPanel.add(ui.Label('Select a year:'))
layerPanel.add(yearSelector);
layerPanel.add(ui.Button({
  label:'Update!',
  onClick: function(){
    // Get current layer and year
    var layerFunc = layerSelector.getValue()
    var year = yearSelector.getValue()
    // filter by year
    lakeMosaic = filterYear(year);
    // compute either ice-on or ice-off
    layerFunc(lakeMosaic, year);
  }
}))
// add info label
layerPanel.add(ui.Label({
  value:'Info & Code', 
  targetUrl:'https://www.github.com/abigailstone/champlain-ice'
}))

Map.add(layerPanel);
// Display default configuration
var layerfunc = layerSelector.getValue();
layerfunc(lakeMosaic, yearSelector.getValue());


// checkbox to display current conditions
var checkPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {position: 'bottom-left', width: '225px'},
})

// Add checkbox to UI, show current ice layer when checked
checkPanel.add(ui.Checkbox({
  label: 'Overlay current conditions',
  onChange: function(value){
    Map.layers().get(1).setShown(value);
  }
}))
checkPanel.add(ui.Label('Image date: '+mostrecent.date().format('MM/dd/yyyy').getInfo()))
Map.add(checkPanel);

// Add current ice conditions and set to invisble
Map.layers().set(1, currentIceLayer)
Map.layers().get(1).setShown(false);


// Chart amplitude values over time
// var chart = ui.Chart.image
//                 .seriesByRegion({
//                   imageCollection: lakeMosaic,
//                   regions: regionRect,
//                   reducer: ee.Reducer.median(),
//                   band: 'smooth',
//                   scale: 100,
//                   xProperty: 'system:time_start'
//                 })
// print(chart)

