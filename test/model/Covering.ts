import { expect } from "chai";
import { S2RegionCoverer } from "nodes2ts";
import { Covering } from "../../src/model/Covering";
import { S2Manager } from "../../src/s2/S2Manager";
import { S2Util } from "../../src/s2/S2Util";

const coveringAround = (latitude: number, longitude: number, radius: number) =>
  new Covering(new S2RegionCoverer().getCoveringCells(S2Util.getBoundingLatLngRectFromQueryRadiusInput({
    CenterPoint: { latitude, longitude },
    RadiusInMeter: radius
  })));

describe("Covering.getGeoHashRanges", () => {
  const CENTERS = [
    { name: "positive geohashes", latitude: 51.51, longitude: -0.13 },
    { name: "negative geohashes", latitude: 40.7, longitude: -74 }
  ];

  for (const center of CENTERS) {
    it(`gives ranges that each stay under one hash key (${center.name})`, () => {
      const covering = coveringAround(center.latitude, center.longitude, 5000);

      for (const hashKeyLength of [2, 6, 9]) {
        const ranges = covering.getGeoHashRanges(hashKeyLength);
        expect(ranges.length).to.be.at.least(covering.getNumberOfCells());
        for (const range of ranges) {
          expect(range.rangeMin.lessThanOrEqual(range.rangeMax)).to.equal(true);
          expect(S2Manager.generateHashKey(range.rangeMin, hashKeyLength).toString())
            .to.equal(S2Manager.generateHashKey(range.rangeMax, hashKeyLength).toString());
        }
      }
    });

    it(`covers the center geohash (${center.name})`, () => {
      const geohash = S2Manager.generateGeohash(center);
      const ranges = coveringAround(center.latitude, center.longitude, 5000).getGeoHashRanges(6);

      expect(ranges.some((r) => r.rangeMin.lessThanOrEqual(geohash) && geohash.lessThanOrEqual(r.rangeMax)))
        .to.equal(true);
    });
  }

  it("returns no ranges for an empty covering", () => {
    expect(new Covering([]).getGeoHashRanges(6)).to.deep.equal([]);
  });
});
