import { expect } from "chai";
import { S2LatLng } from "nodes2ts";
import { S2Util } from "../../src/s2/S2Util";

// One degree of latitude on the S2 earth sphere (radius 6371010 m) is about 111195 m.
const METERS_PER_DEGREE = 111195;

const contains = (rect, latitude: number, longitude: number): boolean =>
  rect.containsLL(S2LatLng.fromDegrees(latitude, longitude));

describe("S2Util.latLngRectFromQueryRectangleInput", () => {
  it("contains the corners and the inside, and not the outside", () => {
    const rect = S2Util.latLngRectFromQueryRectangleInput({
      MinPoint: { latitude: 51.4, longitude: -0.3 },
      MaxPoint: { latitude: 51.6, longitude: 0.1 }
    });

    expect(contains(rect, 51.4, -0.3)).to.equal(true);
    expect(contains(rect, 51.6, 0.1)).to.equal(true);
    expect(contains(rect, 51.5, 0)).to.equal(true);
    expect(contains(rect, 51.7, 0)).to.equal(false);
    expect(contains(rect, 51.5, 0.2)).to.equal(false);
  });

  it("returns null when a corner is missing", () => {
    expect(S2Util.latLngRectFromQueryRectangleInput({
      MinPoint: { latitude: 1, longitude: 1 },
      MaxPoint: null
    })).to.equal(null);
  });
});

describe("S2Util.getBoundingLatLngRectFromQueryRadiusInput", () => {
  const CENTERS = [
    { name: "north-east", latitude: 59, longitude: 10 },
    { name: "north-west", latitude: 40.7, longitude: -74 },
    { name: "south-east", latitude: -33.87, longitude: 151.21 },
    { name: "south-west", latitude: -22.9, longitude: -43.2 }
  ];

  for (const center of CENTERS) {
    it(`spans the radius in latitude and longitude (${center.name})`, () => {
      const radius = 1000;
      const rect = S2Util.getBoundingLatLngRectFromQueryRadiusInput({ CenterPoint: center, RadiusInMeter: radius });

      const latSpan = radius / METERS_PER_DEGREE;
      const lngSpan = latSpan / Math.cos(center.latitude * Math.PI / 180);

      expect(contains(rect, center.latitude, center.longitude)).to.equal(true);
      expect(contains(rect, center.latitude + latSpan * 0.98, center.longitude)).to.equal(true);
      expect(contains(rect, center.latitude - latSpan * 0.98, center.longitude)).to.equal(true);
      expect(contains(rect, center.latitude + latSpan * 1.02, center.longitude)).to.equal(false);
      expect(contains(rect, center.latitude - latSpan * 1.02, center.longitude)).to.equal(false);
      expect(contains(rect, center.latitude, center.longitude + lngSpan * 0.98)).to.equal(true);
      expect(contains(rect, center.latitude, center.longitude - lngSpan * 0.98)).to.equal(true);
      expect(contains(rect, center.latitude, center.longitude + lngSpan * 1.05)).to.equal(false);
      expect(contains(rect, center.latitude, center.longitude - lngSpan * 1.05)).to.equal(false);
    });
  }

  it("grows with the radius", () => {
    const center = { latitude: 59, longitude: 0 };
    const small = S2Util.getBoundingLatLngRectFromQueryRadiusInput({ CenterPoint: center, RadiusInMeter: 100 });
    const large = S2Util.getBoundingLatLngRectFromQueryRadiusInput({ CenterPoint: center, RadiusInMeter: 10000 });

    const nearEdge = 5000 / METERS_PER_DEGREE;
    expect(contains(small, 59 + nearEdge, 0)).to.equal(false);
    expect(contains(large, 59 + nearEdge, 0)).to.equal(true);
  });
});
