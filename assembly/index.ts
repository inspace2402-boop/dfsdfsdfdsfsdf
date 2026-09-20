// Highly optimized WebAssembly module for GIS map projection calculations
// Written in AssemblyScript

@inline
function clearEntireRow(outputOffset: i32, y: i32, bgW: i32): void {
  let rowStartIdx = outputOffset + y * bgW * 4;
  for (let x = 0; x < bgW; x++) {
    store<u32>(rowStartIdx + x * 4, 0);
  }
}

@inline
function clearRowPadding(outputOffset: i32, y: i32, bgW: i32, xMin: i32, xMax: i32): void {
  let rowStartIdx = outputOffset + y * bgW * 4;
  for (let x = 0; x < xMin; x++) {
    store<u32>(rowStartIdx + x * 4, 0);
  }
  for (let x = xMax; x < bgW; x++) {
    store<u32>(rowStartIdx + x * 4, 0);
  }
}

@inline
function rotateAndStore(
  outIdx: i32,
  lambda_rot: f64,
  phi_rot: f64,
  centerLon: f64,
  centerLat: f64,
  aspect: f64,
  srcW: i32,
  srcH: i32,
  inputOffset: i32,
  opacity: f64
): void {
  // Clip out of bounds coordinates for 2D flat maps to prevent repeating background
  if (
    lambda_rot < -3.141592653589793 - 0.0001 || lambda_rot > 3.141592653589793 + 0.0001 ||
    phi_rot < -1.5707963267948966 - 0.0001 || phi_rot > 1.5707963267948966 + 0.0001
  ) {
    store<u8>(outIdx + 3, 0);
    return;
  }

  // Apply inverse spherical rotation (Z-axis roll by aspect, then Y-axis latitude rotation, then Z-axis longitude rotation)
  let cos_phi = Math.cos(phi_rot);
  let x0 = cos_phi * Math.cos(lambda_rot);
  let y0 = cos_phi * Math.sin(lambda_rot);
  let z0 = Math.sin(phi_rot);

  let x_rolled = x0;
  let y_rolled = y0;
  let z_rolled = z0;

  if (aspect != 0.0) {
    let gamma = aspect * Math.PI / 180.0;
    let cos_gamma = Math.cos(gamma);
    let sin_gamma = Math.sin(gamma);
    y_rolled = y0 * cos_gamma + z0 * sin_gamma;
    z_rolled = -y0 * sin_gamma + z0 * cos_gamma;
  }

  // Rotate Y by -centerLat
  let theta = -centerLat * Math.PI / 180.0;
  let cos_theta = Math.cos(theta);
  let sin_theta = Math.sin(theta);

  let x1 = x_rolled * cos_theta + z_rolled * sin_theta;
  let y1 = y_rolled;
  let z1 = -x_rolled * sin_theta + z_rolled * cos_theta;

  // Rotate Z by +centerLon
  let lambda_0 = centerLon * Math.PI / 180.0;
  let cos_lambda = Math.cos(lambda_0);
  let sin_lambda = Math.sin(lambda_0);

  let x2 = x1 * cos_lambda - y1 * sin_lambda;
  let y2 = x1 * sin_lambda + y1 * cos_lambda;
  let z2 = z1;

  if (z2 > 1.0) z2 = 1.0;
  if (z2 < -1.0) z2 = -1.0;
  let lat = Math.asin(z2) * 180.0 / Math.PI;
  let lon = Math.atan2(y2, x2) * 180.0 / Math.PI;

  let valid = true;
  if (lon != lon || lat != lat || lon > 1000000.0 || lon < -1000000.0 || lat > 1000000.0 || lat < -1000000.0) {
    valid = false;
  }

  if (valid) {
    // Normalise longitude to [-180, 180]
    lon = lon - 360.0 * Math.floor((lon + 180.0) / 360.0);

    if (lat >= -90.0 && lat <= 90.0) {
      let sx = Math.floor(((lon + 180.0) / 360.0) * srcW as f64) as i32;
      let sy = Math.floor(((90.0 - lat) / 180.0) * srcH as f64) as i32;

      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        let srcIdx = inputOffset + (sy * srcW + sx) * 4;

        let r = load<u8>(srcIdx);
        let g = load<u8>(srcIdx + 1);
        let b = load<u8>(srcIdx + 2);
        let a = load<u8>(srcIdx + 3);

        store<u8>(outIdx, r);
        store<u8>(outIdx + 1, g);
        store<u8>(outIdx + 2, b);
        store<u8>(outIdx + 3, (a as f64 * opacity) as u8);
      } else {
        store<u8>(outIdx + 3, 0);
      }
    } else {
      store<u8>(outIdx + 3, 0);
    }
  } else {
    store<u8>(outIdx + 3, 0);
  }
}

@inline
function getK_X(index: i32): f64 {
  switch (index) {
    case 0: return 0.9986;
    case 1: return 1.0000;
    case 2: return 0.9986;
    case 3: return 0.9954;
    case 4: return 0.9900;
    case 5: return 0.9822;
    case 6: return 0.9730;
    case 7: return 0.9600;
    case 8: return 0.9427;
    case 9: return 0.9216;
    case 10: return 0.8962;
    case 11: return 0.8679;
    case 12: return 0.8350;
    case 13: return 0.7986;
    case 14: return 0.7597;
    case 15: return 0.7186;
    case 16: return 0.6732;
    case 17: return 0.6213;
    case 18: return 0.5722;
    case 19: return 0.5322;
    default: return 0.5322;
  }
}

@inline
function getK_Y(index: i32): f64 {
  switch (index) {
    case 0: return -0.09879177922184607;
    case 1: return 0.0;
    case 2: return 0.09879177922184607;
    case 3: return 0.19758355844369213;
    case 4: return 0.2963753376655382;
    case 5: return 0.3951671168873843;
    case 6: return 0.4939588961092303;
    case 7: return 0.5927506753310764;
    case 8: return 0.6915424545529225;
    case 9: return 0.7900155506159883;
    case 10: return 0.8876919387820039;
    case 11: return 0.9840935942130989;
    case 12: return 1.0785831508914129;
    case 13: return 1.1705253503113333;
    case 14: return 1.2592764919197573;
    case 15: return 1.3440462221612767;
    case 16: return 1.4238538604344203;
    case 17: return 1.496854796781258;
    case 18: return 1.5553331564265152;
    case 19: return 1.593415793900743;
    default: return 1.593415793900743;
  }
}

export function remapRaster(
  outputOffset: i32,
  inputOffset: i32,
  bgW: i32,
  bgH: i32,
  dimensionsWidth: f64,
  dimensionsHeight: f64,
  srcW: i32,
  srcH: i32,
  projectionType: i32, // 0=equirectangular, 1=mercator, 2=orthographic, 3=azimuthalEqualArea, 4=gnomonic, 5=mollweide, 6=miller, 7=winkel3
  centerLon: f64,
  centerLat: f64,
  aspect: f64,
  zoom: f64,
  globeRadius: f64,
  globeCenterX: f64,
  globeCenterY: f64,
  opacity: f64,
  panX: f64,
  panY: f64,
  viewportZoom: f64,
  rowStart: i32,
  rowCount: i32
): void {
  let defaultScale = Math.min(dimensionsWidth, dimensionsHeight) / (2.0 * Math.PI);
  let scale = defaultScale * zoom;
  if (projectionType == 2) {
    scale = globeRadius;
  }
  if (scale < 0.0001) scale = 0.0001;

  // Every pixel on bgCanvas (0..bgW, 0..bgH) maps directly to the active screen viewport [0..dimensionsWidth, 0..dimensionsHeight]
  let xMin: i32 = 0;
  let xMax: i32 = bgW;
  let yMin: i32 = 0;
  let yMax: i32 = bgH;

  // Optimized Equirectangular (type 0)
  if (projectionType == 0) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    let isFlatFast = aspect == 0.0 && centerLat == 0.0;
    let isFullOpaque = opacity >= 0.999;

    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;
      let phi_rot = y_prime;

      if (isFlatFast) {
        let lat = phi_rot * 180.0 / Math.PI;
        if (lat < -90.0 || lat > 90.0) {
          clearEntireRow(outputOffset, y, bgW);
          continue;
        }
        let sy = Math.floor(((90.0 - lat) / 180.0) * srcH as f64) as i32;
        if (sy < 0 || sy >= srcH) {
          clearEntireRow(outputOffset, y, bgW);
          continue;
        }
        let srcRowOffset = inputOffset + sy * srcW * 4;

        for (let x = xMin; x < xMax; x++) {
          let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
          let px = (canvasX - panX) / viewportZoom;
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let lon = (x_prime * 180.0 / Math.PI) + centerLon;
          lon = lon - 360.0 * Math.floor((lon + 180.0) / 360.0);
          let sx = Math.floor(((lon + 180.0) / 360.0) * srcW as f64) as i32;
          if (sx < 0) sx = 0;
          else if (sx >= srcW) sx = srcW - 1;

          let srcIdx = srcRowOffset + sx * 4;
          let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

          if (isFullOpaque) {
            store<u32>(outIdx, load<u32>(srcIdx));
          } else {
            store<u8>(outIdx, load<u8>(srcIdx));
            store<u8>(outIdx + 1, load<u8>(srcIdx + 1));
            store<u8>(outIdx + 2, load<u8>(srcIdx + 2));
            store<u8>(outIdx + 3, (load<u8>(srcIdx + 3) as f64 * opacity) as u8);
          }
        }
      } else {
        for (let x = xMin; x < xMax; x++) {
          let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
          let px = (canvasX - panX) / viewportZoom;
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let lambda_rot = x_prime;
          let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        }
      }
    }
    return;
  }

  // Optimized Mercator (type 1)
  if (projectionType == 1) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    let isFlatFast = aspect == 0.0 && centerLat == 0.0;
    let isFullOpaque = opacity >= 0.999;

    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;
      
      let maxMercY = 3.10686;
      let clampedY = y_prime;
      if (clampedY > maxMercY) clampedY = maxMercY;
      if (clampedY < -maxMercY) clampedY = -maxMercY;
      let phi_rot = 2.0 * Math.atan(Math.exp(clampedY)) - Math.PI / 2.0;

      if (isFlatFast) {
        let lat = phi_rot * 180.0 / Math.PI;
        if (lat < -90.0 || lat > 90.0) {
          clearEntireRow(outputOffset, y, bgW);
          continue;
        }
        let sy = Math.floor(((90.0 - lat) / 180.0) * srcH as f64) as i32;
        if (sy < 0 || sy >= srcH) {
          clearEntireRow(outputOffset, y, bgW);
          continue;
        }
        let srcRowOffset = inputOffset + sy * srcW * 4;

        for (let x = xMin; x < xMax; x++) {
          let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
          let px = (canvasX - panX) / viewportZoom;
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let lon = (x_prime * 180.0 / Math.PI) + centerLon;
          lon = lon - 360.0 * Math.floor((lon + 180.0) / 360.0);
          let sx = Math.floor(((lon + 180.0) / 360.0) * srcW as f64) as i32;
          if (sx < 0) sx = 0;
          else if (sx >= srcW) sx = srcW - 1;

          let srcIdx = srcRowOffset + sx * 4;
          let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

          if (isFullOpaque) {
            store<u32>(outIdx, load<u32>(srcIdx));
          } else {
            store<u8>(outIdx, load<u8>(srcIdx));
            store<u8>(outIdx + 1, load<u8>(srcIdx + 1));
            store<u8>(outIdx + 2, load<u8>(srcIdx + 2));
            store<u8>(outIdx + 3, (load<u8>(srcIdx + 3) as f64 * opacity) as u8);
          }
        }
      } else {
        for (let x = xMin; x < xMax; x++) {
          let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
          let px = (canvasX - panX) / viewportZoom;
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let lambda_rot = x_prime;
          let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        }
      }
    }
    return;
  }

  // Optimized Orthographic (type 2)
  if (projectionType == 2) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;

    let screenGlobeX = globeCenterX * viewportZoom + panX;
    let screenGlobeY = globeCenterY * viewportZoom + panY;
    let screenRadius = globeRadius * viewportZoom;

    for (let y = rowStart; y < yEnd; y++) {
      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let dyScreen = canvasY - screenGlobeY;
      if (Math.abs(dyScreen) > screenRadius + 1.0) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }

      let dxMax = Math.sqrt(screenRadius * screenRadius - dyScreen * dyScreen);
      let orthoMinCanvasX = screenGlobeX - dxMax - 1.0;
      let orthoMaxCanvasX = screenGlobeX + dxMax + 1.0;
      let rowXMin = Math.max(0.0, Math.floor((orthoMinCanvasX / dimensionsWidth) * (bgW as f64))) as i32;
      let rowXMax = Math.min(bgW as f64, Math.ceil((orthoMaxCanvasX / dimensionsWidth) * (bgW as f64))) as i32;

      if (rowXMin >= rowXMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }

      clearRowPadding(outputOffset, y, bgW, rowXMin, rowXMax);

      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      for (let x = rowXMin; x < rowXMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let dx = px - globeCenterX;
        let dy = py - globeCenterY;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= globeRadius) {
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let rho = Math.sqrt(x_prime * x_prime + y_prime * y_prime);
          if (rho <= 1.0) {
            let phi_rot = Math.asin(y_prime);
            let lambda_rot = Math.atan2(x_prime, Math.sqrt(1.0 - rho * rho));
            rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
          } else {
            store<u8>(outIdx + 3, 0);
          }
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Azimuthal Equal Area (type 3)
  if (projectionType == 3) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let rho = Math.sqrt(x_prime * x_prime + y_prime * y_prime);
        if (rho <= 2.0) {
          let inner = 1.0 - rho * rho / 4.0;
          if (inner < 0.0) inner = 0.0;
          let factor = Math.sqrt(inner);
          let phi_rot = Math.asin(y_prime * factor);
          let lambda_rot = Math.atan2(x_prime * factor, 1.0 - rho * rho / 2.0);
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Gnomonic (type 4)
  if (projectionType == 4) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let rho = Math.sqrt(x_prime * x_prime + y_prime * y_prime);
        if (rho <= 11.43) {
          let factor = 1.0 / Math.sqrt(1.0 + rho * rho);
          let phi_rot = Math.asin(y_prime * factor);
          let lambda_rot = Math.atan2(x_prime, 1.0);
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Mollweide (type 5)
  if (projectionType == 5) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      let t = y_prime / 1.4142135623730951; // Math.sqrt(2.0)
      if (Math.abs(t) <= 1.0) {
        clearRowPadding(outputOffset, y, bgW, xMin, xMax);

        let theta = Math.asin(t);
        let numerator = 2.0 * theta + Math.sin(2.0 * theta);
        let val_sin = numerator / Math.PI;
        if (val_sin > 1.0) val_sin = 1.0;
        if (val_sin < -1.0) val_sin = -1.0;
        let phi_rot = Math.asin(val_sin);
        let cos_theta = Math.cos(theta);

        for (let x = xMin; x < xMax; x++) {
          let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
          let px = (canvasX - panX) / viewportZoom;
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

          if (Math.abs(cos_theta) > 0.0001) {
            let lambda_rot = (Math.PI * x_prime) / (2.8284271247461903 * cos_theta);
            rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
          } else {
            rotateAndStore(outIdx, 0.0, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
          }
        }
      } else {
        clearEntireRow(outputOffset, y, bgW);
      }
    }
    return;
  }

  // Optimized Miller (type 6)
  if (projectionType == 6) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    let isFlatFast = aspect == 0.0 && centerLat == 0.0;
    let isFullOpaque = opacity >= 0.999;

    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;
      let phi_rot = 2.5 * Math.atan(Math.exp(0.8 * y_prime)) - 0.625 * Math.PI;

      if (isFlatFast) {
        let lat = phi_rot * 180.0 / Math.PI;
        if (lat < -90.0 || lat > 90.0) {
          clearEntireRow(outputOffset, y, bgW);
          continue;
        }
        let sy = Math.floor(((90.0 - lat) / 180.0) * srcH as f64) as i32;
        if (sy < 0 || sy >= srcH) {
          clearEntireRow(outputOffset, y, bgW);
          continue;
        }
        let srcRowOffset = inputOffset + sy * srcW * 4;

        for (let x = xMin; x < xMax; x++) {
          let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
          let px = (canvasX - panX) / viewportZoom;
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let lon = (x_prime * 180.0 / Math.PI) + centerLon;
          lon = lon - 360.0 * Math.floor((lon + 180.0) / 360.0);
          let sx = Math.floor(((lon + 180.0) / 360.0) * srcW as f64) as i32;
          if (sx < 0) sx = 0;
          else if (sx >= srcW) sx = srcW - 1;

          let srcIdx = srcRowOffset + sx * 4;
          let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

          if (isFullOpaque) {
            store<u32>(outIdx, load<u32>(srcIdx));
          } else {
            store<u8>(outIdx, load<u8>(srcIdx));
            store<u8>(outIdx + 1, load<u8>(srcIdx + 1));
            store<u8>(outIdx + 2, load<u8>(srcIdx + 2));
            store<u8>(outIdx + 3, (load<u8>(srcIdx + 3) as f64 * opacity) as u8);
          }
        }
      } else {
        for (let x = xMin; x < xMax; x++) {
          let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
          let px = (canvasX - panX) / viewportZoom;
          let x_rel = px - globeCenterX;
          let x_prime = x_rel / scale;
          let lambda_rot = x_prime;
          let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        }
      }
    }
    return;
  }

  // Optimized Winkel Tripel (type 7)
  if (projectionType == 7) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let lambda = x_prime;
        let phi = y_prime;
        let i = 25;
        let halfPi = Math.PI / 2.0;
        let epsilon = 0.000001;
        let solved = false;

        do {
          let cosphi = Math.cos(phi);
          let sinphi = Math.sin(phi);
          let sin_2phi = Math.sin(2.0 * phi);
          let sin2phi = sinphi * sinphi;
          let cos2phi = cosphi * cosphi;
          let sinlambda = Math.sin(lambda);
          let coslambda_2 = Math.cos(lambda / 2.0);
          let sinlambda_2 = Math.sin(lambda / 2.0);
          let sin2lambda_2 = sinlambda_2 * sinlambda_2;
          let C = 1.0 - cos2phi * coslambda_2 * coslambda_2;
          
          let F: f64 = 0.0;
          let E: f64 = 0.0;
          if (C != 0.0) {
            F = 1.0 / C;
            let cosphi_coslambda2 = cosphi * coslambda_2;
            if (cosphi_coslambda2 > 1.0) cosphi_coslambda2 = 1.0;
            if (cosphi_coslambda2 < -1.0) cosphi_coslambda2 = -1.0;
            E = Math.acos(cosphi_coslambda2) * Math.sqrt(F);
          }
          
          let fx = 0.5 * (2.0 * E * cosphi * sinlambda_2 + lambda / halfPi) - x_prime;
          let fy = 0.5 * (E * sinphi + phi) - y_prime;
          
          let dxdlambda = 0.5 * F * (cos2phi * sin2lambda_2 + E * cosphi * coslambda_2 * sin_2phi) + 0.5 / halfPi;
          let dxdphi = F * (sinlambda * sin_2phi / 4.0 - E * sinphi * sinlambda_2);
          let dydlambda = 0.125 * F * (sin_2phi * sinlambda_2 - E * sinphi * cos2phi * sinlambda);
          let dydphi = 0.5 * F * (sin2phi * coslambda_2 + E * sin2lambda_2 * cosphi) + 0.5;
          let denominator = dxdphi * dydlambda - dydphi * dxdlambda;
          
          if (Math.abs(denominator) > 1e-12) {
            let dlambda = (fy * dxdphi - fx * dydphi) / denominator;
            let dphi = (fx * dydlambda - fy * dxdlambda) / denominator;
            lambda -= dlambda;
            phi -= dphi;
            if (Math.abs(dlambda) <= epsilon && Math.abs(dphi) <= epsilon) {
              solved = true;
              break;
            }
          } else {
            break;
          }
        } while (--i > 0);

        if (solved || i == 0) {
          rotateAndStore(outIdx, lambda, phi, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Equal Earth (type 8)
  if (projectionType == 8) {
    let A1 = 1.340264;
    let A2 = -0.081106;
    let A3 = 0.000893;
    let A4 = 0.003796;
    let M = Math.sqrt(3.0) / 2.0;

    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      let l = y_prime;
      let l2 = l * l;
      let l6 = l2 * l2 * l2;
      for (let i = 0; i < 12; ++i) {
        let fy = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y_prime;
        let fpy = A1 + 3.0 * A2 * l2 + l6 * (7.0 * A3 + 9.0 * A4 * l2);
        let delta = fy / fpy;
        l -= delta;
        l2 = l * l;
        l6 = l2 * l2 * l2;
        if (Math.abs(delta) < 1e-12) break;
      }
      let phi_rot = Math.asin(Math.sin(l) / M);

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        if (phi_rot == phi_rot) { // check NaN
          let lambda_rot = M * x_prime * (A1 + 3.0 * A2 * l2 + l6 * (7.0 * A3 + 9.0 * A4 * l2)) / Math.cos(l);
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Robinson (type 9)
  if (projectionType == 9) {
    let degrees = 180.0 / Math.PI;
    let radians = Math.PI / 180.0;
    
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let phi = y_prime * degrees;
        let i = Math.min(18.0, Math.abs(phi / 5.0));
        let i0 = Math.max(0.0, Math.floor(i)) as i32;
        let di = 0.0;
        let solved = false;

        do {
          let ay = getK_Y(i0);
          let by = getK_Y(i0 + 1);
          let cy = getK_Y(Math.min(19, i0 + 2) as i32);
          let u = cy - ay;
          let v = cy - 2.0 * by + ay;
          let t = 2.0 * (Math.abs(y_prime) - by) / u;
          let c = v / u;
          di = t * (1.0 - c * t * (1.0 - 2.0 * c * t));
          
          if (di >= 0.0 || i0 == 1) {
            phi = (y_prime >= 0.0 ? 5.0 : -5.0) * (di + (i0 as f64));
            let j = 50;
            let delta = 0.0;
            do {
              let i_loop = Math.min(18.0, Math.abs(phi) / 5.0);
              let i0_loop = Math.floor(i_loop) as i32;
              let di_loop = i_loop - (i0_loop as f64);
              let ay_l = getK_Y(i0_loop);
              let by_l = getK_Y(i0_loop + 1);
              let cy_l = getK_Y(Math.min(19, i0_loop + 2) as i32);
              
              let sign_y = y_prime >= 0.0 ? 1.0 : -1.0;
              let computed_y = sign_y * (by_l + di_loop * (cy_l - ay_l) / 2.0 + di_loop * di_loop * (cy_l - 2.0 * by_l + ay_l) / 2.0);
              delta = computed_y - y_prime;
              phi -= delta * degrees;
            } while (Math.abs(delta) > 1e-12 && --j > 0);
            
            solved = true;
            break;
          }
        } while (--i0 >= 0);

        if (solved) {
          let i_final = Math.min(18.0, Math.abs(phi) / 5.0);
          let i0_final = Math.floor(i_final) as i32;
          let di_final = i_final - (i0_final as f64);
          
          let ax = getK_X(i0_final);
          let bx = getK_X(i0_final + 1);
          let cx = getK_X(Math.min(19, i0_final + 2) as i32);
          
          let den = bx + di_final * (cx - ax) / 2.0 + di_final * di_final * (cx - 2.0 * bx + ax) / 2.0;
          let lambda_rot = x_prime / den;
          let phi_rot = phi * radians;
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Sinusoidal (type 10)
  if (projectionType == 10) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;
      let phi_rot = y_prime;

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let cos_phi = Math.cos(y_prime);
        if (Math.abs(cos_phi) > 0.0001) {
          let lambda_rot = x_prime / cos_phi;
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          rotateAndStore(outIdx, 0.0, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        }
      }
    }
    return;
  }

  // Optimized Eckert I (type 11)
  if (projectionType == 11) {
    let alpha = Math.sqrt(8.0 / (3.0 * Math.PI));

    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;
      let phi_rot = y_prime / alpha;

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let den = alpha * (1.0 - Math.abs(phi_rot) / Math.PI);
        if (Math.abs(den) > 0.0001) {
          let lambda_rot = x_prime / den;
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Eckert IV (type 12)
  if (projectionType == 12) {
    let sqrt_pi_4_pi = Math.sqrt(Math.PI * (4.0 + Math.PI));

    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      let A = y_prime * Math.sqrt((4.0 + Math.PI) / Math.PI) / 2.0;
      if (A > 1.0) A = 1.0;
      if (A < -1.0) A = -1.0;
      let k = Math.asin(A);
      let c = Math.cos(k);
      let phi_rot = Math.asin((k + A * (c + 2.0)) / (2.0 + Math.PI / 2.0));

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let den = (2.0 / sqrt_pi_4_pi) * (1.0 + c);
        if (Math.abs(den) > 0.0001) {
          let lambda_rot = x_prime / den;
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }

  // Optimized Times (type 13)
  if (projectionType == 13) {
    let yEnd = rowStart + rowCount;
    if (yEnd > bgH) yEnd = bgH;
    for (let y = rowStart; y < yEnd; y++) {
      if (y < yMin || y >= yMax || xMin >= xMax) {
        clearEntireRow(outputOffset, y, bgW);
        continue;
      }
      clearRowPadding(outputOffset, y, bgW, xMin, xMax);

      let canvasY = (y as f64 / bgH as f64) * dimensionsHeight;
      let py = (canvasY - panY) / viewportZoom;
      let y_rel = py - globeCenterY;
      let y_prime = -y_rel / scale;

      let t = y_prime / 1.70711;
      let s = Math.sin((Math.PI / 4.0) * t);
      let phi_rot = 2.0 * Math.atan(t);

      for (let x = xMin; x < xMax; x++) {
        let canvasX = (x as f64 / bgW as f64) * dimensionsWidth;
        let px = (canvasX - panX) / viewportZoom;
        let x_rel = px - globeCenterX;
        let x_prime = x_rel / scale;
        let outIdx: i32 = outputOffset + (y * bgW + x) * 4;

        let den = 0.74482 - 0.34588 * s * s;
        if (Math.abs(den) > 0.0001) {
          let lambda_rot = x_prime / den;
          rotateAndStore(outIdx, lambda_rot, phi_rot, centerLon, centerLat, aspect, srcW, srcH, inputOffset, opacity);
        } else {
          store<u8>(outIdx + 3, 0);
        }
      }
    }
    return;
  }
}
