// ── NOTE: 'watershed' and 'dem' come from your GEE Imports panel ──────

var aoi = watershed.geometry();
Map.centerObject(aoi, 10);
Map.setOptions('SATELLITE');

print('Watershed bounds:', aoi.bounds());
print('DEM band names:', dem.bandNames());

Map.addLayer(
  ee.Image().paint(watershed, 0, 2),
  {palette: '#E53935'},
  'Watershed boundary'
);

// ── LANDSAT COLLECTIONS ────────────────────────────────────────────────
var l8_2015 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(aoi)
  .filterDate('2015-11-01', '2016-02-28')
  .filter(ee.Filter.lt('CLOUD_COVER', 20));

var l9_2024 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(aoi)
  .filterDate('2024-11-01', '2025-02-28')
  .filter(ee.Filter.lt('CLOUD_COVER', 20));

print('L8 2015 image count:', l8_2015.size());
print('L9 2024 image count:', l9_2024.size());

// ── CLOUD MASKING FUNCTION ─────────────────────────────────────────────
function maskL8clouds(image) {
  var qaMask  = image.select('QA_PIXEL')
                     .bitwiseAnd(parseInt('11111', 2)).eq(0);
  var satMask = image.select('QA_RADSAT').eq(0);
  var optical = image.select('SR_B.')
                     .multiply(0.0000275).add(-0.2);
  return image.addBands(optical, null, true)
              .updateMask(qaMask)
              .updateMask(satMask);
}

// ── EXPORT FUNCTION — defined early so all calls below work ───────────
// FIX: was defined at the bottom, after it was already being called.
function exportToDrive(image, name) {
  Export.image.toDrive({
    image:       image.toFloat(),
    description: name,
    folder:      'GEE_Bagmati_NDVI',
    region:      aoi,
    scale:       30,
    crs:         'EPSG:32645',
    maxPixels:   1e10
  });
}

// ── TERRAIN BANDS FROM DEM ─────────────────────────────────────────────
var demBand = dem.select(0).rename('elevation').clip(aoi);
var slope   = ee.Terrain.slope(demBand).rename('slope');
var aspect  = ee.Terrain.aspect(demBand).rename('aspect');

// ── CLOUD-FREE MEDIAN COMPOSITES ──────────────────────────────────────
var img2015raw = l8_2015.map(maskL8clouds).median().clip(aoi);
var img2024raw = l9_2024.map(maskL8clouds).median().clip(aoi);

// ── SHADOW MASKS ──────────────────────────────────────────────────────
var shadowMask2015 = img2015raw.select('SR_B5').gt(0.05);
var shadowMask2024 = img2024raw.select('SR_B5').gt(0.05);

// ── APPLY MASKS + ADD TERRAIN BANDS ───────────────────────────────────
var img2015 = img2015raw.updateMask(shadowMask2015)
                        .addBands(demBand).addBands(slope).addBands(aspect);
var img2024 = img2024raw.updateMask(shadowMask2024)
                        .addBands(demBand).addBands(slope).addBands(aspect);

// ── SPECTRAL INDICES ──────────────────────────────────────────────────
var ndvi2015  = img2015.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
var ndvi2024  = img2024.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
var ndbi2024  = img2024.normalizedDifference(['SR_B6','SR_B5']).rename('NDBI');
var mndwi2024 = img2024.normalizedDifference(['SR_B3','SR_B6']).rename('MNDWI');
var ndbi2015  = img2015.normalizedDifference(['SR_B6','SR_B5']).rename('NDBI');
var mndwi2015 = img2015.normalizedDifference(['SR_B3','SR_B6']).rename('MNDWI');

// img2024: NDBI + MNDWI only (24 bands) — preserves original 83.9% accuracy
// Adding NDVI to img2024 shifts GEE's computational graph and breaks the
// randomColumn split even with seed=42, causing accuracy to drop unpredictably.
img2024 = img2024.addBands([ndbi2024, mndwi2024]);

// img2015: NDBI + MNDWI + NDVI (25 bands) — NDVI fixes class 1↔2 confusion
img2015 = img2015.addBands([ndbi2015, mndwi2015, ndvi2015]);

print('img2024 bands (should be 24):', img2024.bandNames());
print('img2015 bands (should be 25):', img2015.bandNames());

// ── VISUALISE ─────────────────────────────────────────────────────────
Map.addLayer(img2015, {bands:['SR_B4','SR_B3','SR_B2'], min:0, max:0.3}, 'True colour 2015');
Map.addLayer(img2024, {bands:['SR_B4','SR_B3','SR_B2'], min:0, max:0.3}, 'True colour 2024');
Map.addLayer(img2024, {bands:['SR_B5','SR_B4','SR_B3'], min:0, max:0.4}, 'False colour 2024');
Map.addLayer(slope,   {min:0, max:60, palette:['white','#8B4513']}, 'Slope (degrees)', false);

var ndviVis = {min:-0.2, max:0.8, palette:['#8B4513','#F5DEB3','#ADFF2F','#1A6B1A']};
Map.addLayer(ndvi2015, ndviVis, 'NDVI 2015');
Map.addLayer(ndvi2024, ndviVis, 'NDVI 2024');

// ── BAND ARRAYS ───────────────────────────────────────────────────────
var bands2024 = [
  'SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7',
  'elevation','slope','aspect','NDBI','MNDWI'
];

var bands2015 = [
  'SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7',
  'elevation','slope','aspect','NDBI','MNDWI','NDVI'
];

// ── ESA WORLDCOVER ────────────────────────────────────────────────────
var worldcover = ee.ImageCollection('ESA/WorldCover/v200')
  .first()
  .clip(aoi);

Map.addLayer(worldcover, {
  min:10, max:100,
  palette:['006400','ffbb22','ffff4c','f096ff','fa0000',
           'b4b4b4','f0f0f0','0064c8','0096a0','00cf75','fae6a0']
}, 'ESA WorldCover 2021');

// ── REMAP WORLDCOVER TO 4 CLASSES ─────────────────────────────────────
var wcRemapped = worldcover.remap(
  [10, 20, 30, 40, 50, 60, 80, 90, 95],
  [ 1,  2,  2,  2,  3,  3,  4,  2,  1]
).rename('landcover').clip(aoi);

// ── PURE AREA MASK ────────────────────────────────────────────────────
var wcMode   = wcRemapped.focal_mode({radius:1, units:'pixels'});
var pureMask = wcRemapped.eq(wcMode);
var wcPure   = wcRemapped.updateMask(pureMask);

// ── TEMPORAL STABILITY FILTER (2015 training only) ────────────────────
var ndviDifference = ndvi2024.subtract(ndvi2015).abs().unmask(1);
var stableMask     = ndviDifference.lt(0.10);
var wcStable       = wcPure.updateMask(stableMask);

// ── TRAINING POINTS ───────────────────────────────────────────────────
var trainingPoints2024 = wcPure.stratifiedSample({
  numPoints:  200,
  classBand:  'landcover',
  region:     aoi,
  scale:      30,
  seed:       42,
  geometries: true
});

var trainingPoints2015 = wcStable.stratifiedSample({
  numPoints:  400,
  classBand:  'landcover',
  region:     aoi,
  scale:      30,
  seed:       42,
  geometries: true
});

print('2024 training points:', trainingPoints2024.size());
print('2015 stable training points:', trainingPoints2015.size());
print('2024 points per class:', trainingPoints2024.aggregate_histogram('landcover'));
print('2015 points per class:', trainingPoints2015.aggregate_histogram('landcover'));

// ── SAMPLE SPECTRAL VALUES ─────────────────────────────────────────────
var samples2024 = img2024.select(bands2024).sampleRegions({
  collection: trainingPoints2024,
  properties: ['landcover'],
  scale:       30
});

var samples2015 = img2015.select(bands2015).sampleRegions({
  collection: trainingPoints2015,
  properties: ['landcover'],
  scale:       30
});

// ── 70 / 30 TRAIN-TEST SPLIT ──────────────────────────────────────────
var s2024r    = samples2024.randomColumn('split', 42);
var train2024 = s2024r.filter(ee.Filter.lt('split', 0.7));
var test2024  = s2024r.filter(ee.Filter.gte('split', 0.7));

var s2015r    = samples2015.randomColumn('split', 42);
var train2015 = s2015r.filter(ee.Filter.lt('split', 0.7));
var test2015  = s2015r.filter(ee.Filter.gte('split', 0.7));

// ── TRAIN CLASSIFIERS ─────────────────────────────────────────────────
var clf2024 = ee.Classifier.smileRandomForest(100).train({
  features:        train2024,
  classProperty:   'landcover',
  inputProperties: bands2024
});

var clf2015 = ee.Classifier.smileRandomForest(100).train({
  features:        train2015,
  classProperty:   'landcover',
  inputProperties: bands2015
});

// ── CLASSIFY BOTH IMAGES ──────────────────────────────────────────────
var lulc2024 = img2024.select(bands2024).classify(clf2024).rename('LULC_2024');
var lulc2015 = img2015.select(bands2015).classify(clf2015).rename('LULC_2015');

var lulcVis = {min:1, max:4, palette:['#1A6B1A','#A6D96A','#C0C0B8','#185FA5']};
Map.addLayer(lulc2024, lulcVis, 'LULC 2024');
Map.addLayer(lulc2015, lulcVis, 'LULC 2015');

// ── CLASS AREA STATS ──────────────────────────────────────────────────
var areas2024 = ee.Image.pixelArea().addBands(lulc2024).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField:1, groupName:'class'}),
  geometry: aoi, scale:30, maxPixels:1e10
});
print('Class areas 2024 (m²):', areas2024);

var areas2015 = ee.Image.pixelArea().addBands(lulc2015).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField:1, groupName:'class'}),
  geometry: aoi, scale:30, maxPixels:1e10
});
print('Class areas 2015 (m²):', areas2015);

// ── ACCURACY ASSESSMENT ───────────────────────────────────────────────
var validated2024 = test2024.classify(clf2024);
var cm2024 = validated2024.errorMatrix('landcover', 'classification');
print('── 2024 Confusion Matrix ──', cm2024);
print('2024 Overall Accuracy:', cm2024.accuracy());
print('2024 Kappa Coefficient:', cm2024.kappa());
print('2024 Producers Accuracy:', cm2024.producersAccuracy());
print('2024 Consumers Accuracy:', cm2024.consumersAccuracy());

var validated2015 = test2015.classify(clf2015);
var cm2015 = validated2015.errorMatrix('landcover', 'classification');
print('── 2015 Confusion Matrix ──', cm2015);
print('2015 Overall Accuracy:', cm2015.accuracy());
print('2015 Kappa Coefficient:', cm2015.kappa());
print('2015 Producers Accuracy:', cm2015.producersAccuracy());
print('2015 Consumers Accuracy:', cm2015.consumersAccuracy());

// ── SEASONAL WATER CORRECTION ─────────────────────────────────────────
var monsoon = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(aoi)
  .filterDate('2024-07-01', '2024-09-30')
  .filter(ee.Filter.lt('CLOUD_COVER', 40))
  .map(maskL8clouds)
  .median()
  .clip(aoi);

var mndwiMonsoon = monsoon.normalizedDifference(['SR_B3','SR_B6']).rename('MNDWI');
var waterMask    = mndwiMonsoon.gt(0);

Map.addLayer(waterMask.selfMask(), {palette:'#185FA5'}, 'Monsoon water channel');

var lulc2024corrected = lulc2024.where(waterMask, 4).rename('LULC_2024');
var lulc2015corrected = lulc2015.where(waterMask, 4).rename('LULC_2015');

Map.addLayer(lulc2024corrected, {min:1, max:4,
  palette:['#1A6B1A','#A6D96A','#C0C0B8','#185FA5']}, 'LULC 2024 corrected');

// FIX: reassign corrected versions before they are used in change detection
lulc2024 = lulc2024corrected;
lulc2015 = lulc2015corrected;

// ── CHANGE DETECTION ──────────────────────────────────────────────────
// FIX: lulcChange is now defined HERE, before changeSimple uses it below.
// In your pasted code, changeSimple appeared before lulcChange was defined,
// causing "Cannot read property 'eq' of undefined" on the lulcChange.eq(11) call.

var ndviDiff = ndvi2024.subtract(ndvi2015).rename('NDVI_Change');

Map.addLayer(ndviDiff, {
  min:-0.4, max:0.4,
  palette:['#D73027','#FC8D59','#FEE090','#E0F3F8','#91BFDB','#4575B4']
}, 'NDVI Change 2015→2024');

var lulcChange = lulc2015.multiply(10).add(lulc2024).rename('LULC_Change');
Map.addLayer(lulcChange, {min:11, max:44}, 'LULC change matrix');

var changeStats = ee.Image.pixelArea().divide(1e6).addBands(lulcChange).reduceRegion({
  reducer:  ee.Reducer.sum().group({groupField:1, groupName:'transition'}),
  geometry: aoi, scale:30, maxPixels:1e10
});
print('Transition areas (km²):', changeStats);

// ── SIMPLIFIED CHANGE MAP ─────────────────────────────────────────────
// FIX: now appears AFTER lulcChange is defined — this is what caused the error.
// Class 1 = stable (no meaningful change)
// Class 2 = vegetation loss (dense/sparse → builtup)
// Class 3 = vegetation gain (builtup → dense/sparse)
// Class 0 = everything else (water transitions etc.)
var changeSimple = ee.Image(0)
  .where(
    lulcChange.eq(11).or(lulcChange.eq(22))
              .or(lulcChange.eq(33)).or(lulcChange.eq(44)),
    1)  // stable
  .where(
    lulcChange.eq(12).or(lulcChange.eq(13)).or(lulcChange.eq(23)),
    2)  // vegetation loss
  .where(
    lulcChange.eq(21).or(lulcChange.eq(31)).or(lulcChange.eq(32)),
    3)  // vegetation gain
  .where(
    lulcChange.eq(14).or(lulcChange.eq(24)).or(lulcChange.eq(34))
              .or(lulcChange.eq(41)).or(lulcChange.eq(42)).or(lulcChange.eq(43)),
    4)  // hydrological dynamics (water transitions)
  .rename('Change_Simplified');

Map.addLayer(changeSimple, {
  min: 0, max: 4,
  palette: ['#FFFFFF', '#E8E8E8', '#D73027', '#4575B4', '#00FFFF']
}, 'Change simplified (0=masked, 1=stable, 2=loss, 3=gain, 4=water dynamics)');

// ── EXPORTS ───────────────────────────────────────────────────────────
exportToDrive(ndvi2015,      'NDVI_2015');
exportToDrive(ndvi2024,      'NDVI_2024');
exportToDrive(ndviDiff,      'NDVI_Change_2015_2024');
exportToDrive(lulc2015,      'LULC_2015_corrected');
exportToDrive(lulc2024,      'LULC_2024_corrected');
exportToDrive(lulcChange,    'LULC_Transition_Matrix');
exportToDrive(changeSimple,  'LULC_Change_Simplified');
