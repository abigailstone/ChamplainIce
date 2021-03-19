exports.getWaterMask = function(landcover){
  /* Create a water mask based on a NLCD image
  * @param: most recent National Land Cover Database ee.Image
  * @return: binary ee.Image water mask
  */
  var waterKernel = ee.Kernel.circle({radius: 1});
  var waterMask = landcover.eq(11)
                  // Erode and then dilate to close holes
                  .focal_min({kernel:waterKernel, iterations:3})
                  .focal_max({kernel:waterKernel, iterations:3})
                  // Masking
                  .selfMask()
                  .rename('Water');
                  
  return waterMask;
}

exports.mosaicByDate = function (collection){
  /* Create a mosaicked ImageCollection of the region by date
  * @param: input ee.ImageCollection to mosaic 
  * @return: ee.ImageCollection with one image per date
  */
  var imlist = collection.toList(collection.size());
  
  // Extract unique dates from the ImageCollection
  var uniqueDates = imlist.map(function(im){
    return ee.Image(im).date().format("YYYY-MM-dd")
  }).distinct();
  
  // Create a list of images mosaicked by date
  var mosaicImList = uniqueDates.map(function(d){
    d = ee.Date(d)
    var im = collection.filterDate(d, d.advance(1, "day"))
                       .mosaic();
    
    return im.set("system:time_start", d.millis(),
                  "system:id", d.format("YYYY-MM-dd"))
  });
  
  // Convert back to ImageCollection and sort by date
  var mosaicked = ee.ImageCollection(mosaicImList).sort('system:time_start', false);
  return mosaicked;
  
}

exports.otsu = function(histogram) {
  /* Uses Otsu's Method to create a threshold
  * @param: a histogram: image.reduceRegion(ee.Reducer.histogram()
  * @return: 
  * based off of:
  * https://medium.com/google-earth/otsus-method-for-image-segmentation-f5c48f405e
  */
  var counts = ee.Array(ee.Dictionary(histogram.get('smooth')).get('histogram'));
  var means = ee.Array(ee.Dictionary(histogram.get('smooth')).get('bucketMeans'));
  var size = means.length().get([0]);
  var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);
  var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);
  var mean = sum.divide(total);
  
  var indices = ee.List.sequence(1, size);
  
  // Compute between sum of squares, where each mean partitions the data.
  var bss = indices.map(function(i) {
    var aCounts = counts.slice(0, 0, i);
    var aCount = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]);
    var aMeans = means.slice(0, 0, i);
    var aMean = aMeans.multiply(aCounts)
        .reduce(ee.Reducer.sum(), [0]).get([0])
        .divide(aCount);
    var bCount = total.subtract(aCount);
    var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount);
    return aCount.multiply(aMean.subtract(mean).pow(2)).add(
           bCount.multiply(bMean.subtract(mean).pow(2)));
  });
  
  // Return the mean value corresponding to the maximum BSS.
  return means.sort(bss).get([-1]);
};


exports.getMaxDifference = function(stack){
  /* Maximum difference between first image and subsequent images -- for ice on and ice off
  * @param: image stack clipped to date range for ice on or ice off 
  * @return: image by date 
  */
  var firstimage = stack.sort('system:time_start', true).first()
  // Add difference from first image as a band
  var withDiff = stack.map(function(img){
                            var diff = img.subtract(firstimage).abs().rename('diff');
                            return img.addBands(diff);
                          })
                         .sort('system:time_start', false);
  // Get maximum difference
  var maxdiff = withDiff.select('diff').max();
  
  // Create result image with
  var updateMaxDate = withDiff.select('diff')
                            .map(function(img){
                                var dateband = img.where(img.eq(maxdiff), 
                                                        ee.Image.constant(img.date().millis()))
                                return img.addBands(dateband).rename('diff', 'date')
                            });
  var icedate = updateMaxDate.select('date').max()
  return icedate
}

exports.getStretchParams = function(img, region, percent) { 
  /* Get visualization parameters for a percentil stretched image
  * @param: img = ee.Image to display
  * @param: region = ee.Geometry, a polygon around the region
  * @param: percent = ee.Number, the percentile cut 
  * @return: ee.Dictionary of visualization parameters
  */
  var lower_pct = ee.Number(100).subtract(percent).divide(2);  
  var upper_pct = ee.Number(100).subtract(lower_pct);  
  // get percentile numbers with a reduction
  var stats = img.reduceRegion({    
    reducer: ee.Reducer.percentile({
      percentiles: [lower_pct, upper_pct]
    }).setOutputs(['lower', 'upper']),    
    geometry: region,    
    scale: 30,     
    bestEffort: true  
  });  
  // create dictionary
  var visparams = ee.Dictionary({      
    min: ee.Number(stats.get('date_lower')),      
    max: ee.Number(stats.get('date_upper')),  
    palette:'blue,aqua'
  });  
  
  return visparams.getInfo()
};
