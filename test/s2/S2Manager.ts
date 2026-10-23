import { S2Manager } from "../../src/s2/S2Manager";
import { expect } from "chai";
import Long from "long";

describe('S2Manager', () => {
    it('generateGeoHash', () => {
        expect(S2Manager.generateGeohash({
            latitude: 52.1,
            longitude: 2
        }).toString(10)).to.equal('5177531549489041509');
    });

    it('generateHashKey', () => {
        expect(S2Manager.generateHashKey(Long.fromString('5177531549489041509', false, 10), 6).toNumber()).to.equal(517753);
    });
});

describe('S2Manager.generateHashKey', () => {
    it('keeps the first hashKeyLength digits of a positive geohash', () => {
        const geohash = Long.fromString('5221366118452580119');
        expect(S2Manager.generateHashKey(geohash, 1).toString()).to.equal('5');
        expect(S2Manager.generateHashKey(geohash, 2).toString()).to.equal('52');
        expect(S2Manager.generateHashKey(geohash, 10).toString()).to.equal('5221366118');
    });

    it('does not count the minus sign of a negative geohash', () => {
        const geohash = Long.fromString('-8520148344981272079');
        expect(S2Manager.generateHashKey(geohash, 2).toString()).to.equal('-85');
        expect(S2Manager.generateHashKey(geohash, 6).toString()).to.equal('-852014');
    });

    it('works on a geohash with fewer than 19 digits', () => {
        expect(S2Manager.generateHashKey(Long.fromString('43205404257883395'), 6).toString()).to.equal('432054');
    });
});

describe('S2Manager.generateGeohash', () => {
    it('gives a negative geohash on some S2 faces', () => {
        expect(S2Manager.generateGeohash({ latitude: 40.7, longitude: -74 }).toString()).to.equal('-8520148344981272079');
    });

    it('gives the same geohash for the same point and a different one for a nearby point', () => {
        const a = S2Manager.generateGeohash({ latitude: 51.51, longitude: -0.13 });
        const b = S2Manager.generateGeohash({ latitude: 51.51, longitude: -0.13 });
        const c = S2Manager.generateGeohash({ latitude: 51.5101, longitude: -0.13 });
        expect(a.equals(b)).to.equal(true);
        expect(a.equals(c)).to.equal(false);
    });

    it('puts nearby points under the same short hash key', () => {
        const a = S2Manager.generateGeohash({ latitude: 51.51, longitude: -0.13 });
        const c = S2Manager.generateGeohash({ latitude: 51.5101, longitude: -0.13 });
        expect(S2Manager.generateHashKey(a, 6).equals(S2Manager.generateHashKey(c, 6))).to.equal(true);
    });
});
