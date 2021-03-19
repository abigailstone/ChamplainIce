/*
* Frost Filter
* @param: img = Raw ee.ImageCollection
* @param: kernelSize = Kernel size for filter (3, 5, 7)
* @param: damp = dampening factor 
* @return: Smoothed ee.ImageCollection
*/
exports.frostFilter = function(collection, kernelSize, damp){
  
  // Create weighted kernel
  var distanceKernel = ee.Kernel.euclidean(~~(kernelSize/2));
  var weights = ee.List.repeat(ee.List.repeat(1, kernelSize), kernelSize);
  var kernel = ee.Kernel.fixed(kernelSize, kernelSize, weights, 
                              ~~(kernelSize/2), ~~(kernelSize/2), false);
                              
  var filteredCollection = collection.map(function(image){

    // Local statistics
    var mean = image.reduceNeighborhood(ee.Reducer.mean(), kernel);
    var variance = image.reduceNeighborhood(ee.Reducer.variance(), kernel);
    
    // Compute result image 
    var sigma = variance.multiply(damp)
                        .divide(mean.multiply(mean));
    var weighted = sigma.exp()
                        .reduceNeighborhood(ee.Reducer.mean(), distanceKernel);
    
    var smooth = image.multiply(weighted)
                   .reduceNeighborhood(ee.Reducer.sum(), kernel)
                   .divide(weighted.reduceNeighborhood(ee.Reducer.sum(), kernel))
                   .rename('smooth');

    return image.addBands(smooth)

  });
  
  return filteredCollection
  
}
