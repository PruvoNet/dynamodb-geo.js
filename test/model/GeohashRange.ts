import { GeohashRange } from "../../src/model/GeohashRange";
import { expect } from "chai";
import Long from "long";

describe('GeohashRange.trySplit', function () {

    const range = new GeohashRange(Long.fromString('1000000000000000000'), Long.fromString('1000000000010000000'));

    it('returns the same range when nothing needs splitting', function () {
        expect(range.trySplit(1)).to.deep.equal([range]);
        expect(range.trySplit(3)).to.deep.equal([range]);
        expect(range.trySplit(4)).to.deep.equal([range]);
        expect(range.trySplit(5)).to.deep.equal([range]);
        expect(range.trySplit(6)).to.deep.equal([range]);
        expect(range.trySplit(7)).to.deep.equal([range]);
        expect(range.trySplit(8)).to.deep.equal([range]);
        expect(range.trySplit(9)).to.deep.equal([range]);
        expect(range.trySplit(10)).to.deep.equal([range]);
        expect(range.trySplit(11)).to.deep.equal([range]);
    });

    it('splits correctly on the given digit', function () {
        expect(range.trySplit(12)).to.deep.equal([
            new GeohashRange(Long.fromString('1000000000000000000'), Long.fromString('1000000000009999999')),
            new GeohashRange(Long.fromString('1000000000010000000'), Long.fromString('1000000000010000000'))
        ]);

        expect(range.trySplit(13)).to.deep.equal([
            new GeohashRange(Long.fromString('1000000000000000000'), Long.fromString('1000000000000999999')),
            new GeohashRange(Long.fromString('1000000000001000000'), Long.fromString('1000000000001999999')),
            new GeohashRange(Long.fromString('1000000000002000000'), Long.fromString('1000000000002999999')),
            new GeohashRange(Long.fromString('1000000000003000000'), Long.fromString('1000000000003999999')),
            new GeohashRange(Long.fromString('1000000000004000000'), Long.fromString('1000000000004999999')),
            new GeohashRange(Long.fromString('1000000000005000000'), Long.fromString('1000000000005999999')),
            new GeohashRange(Long.fromString('1000000000006000000'), Long.fromString('1000000000006999999')),
            new GeohashRange(Long.fromString('1000000000007000000'), Long.fromString('1000000000007999999')),
            new GeohashRange(Long.fromString('1000000000008000000'), Long.fromString('1000000000008999999')),
            new GeohashRange(Long.fromString('1000000000009000000'), Long.fromString('1000000000009999999')),
            new GeohashRange(Long.fromString('1000000000010000000'), Long.fromString('1000000000010000000'))
        ]);
    });
});

describe('GeohashRange constructor', function () {
    it('accepts numbers and Long values', function () {
        const range = new GeohashRange(10, Long.fromNumber(20));
        expect(range.rangeMin.toString()).to.equal('10');
        expect(range.rangeMax.toString()).to.equal('20');
    });
});

describe('GeohashRange.trySplit with the documented examples', function () {
    it('splits a positive range on the hash key', function () {
        expect(new GeohashRange(123456789, 125678912).trySplit(3)).to.deep.equal([
            new GeohashRange(123456789, 123999999),
            new GeohashRange(124000000, 124999999),
            new GeohashRange(125000000, 125678912)
        ]);
    });

    it('splits a negative range on the hash key', function () {
        expect(new GeohashRange(-125678912, -123456789).trySplit(3)).to.deep.equal([
            new GeohashRange(-125678912, -125000000),
            new GeohashRange(-124999999, -124000000),
            new GeohashRange(-123999999, -123456789)
        ]);
    });
});

describe('GeohashRange.tryMerge', function () {
    it('extends the max when the other range starts right after this one', function () {
        const range = new GeohashRange(10, 20);
        expect(range.tryMerge(new GeohashRange(22, 30))).to.equal(true);
        expect(range).to.deep.equal(new GeohashRange(10, 30));
    });

    it('extends the min when the other range ends right before this one', function () {
        const range = new GeohashRange(22, 30);
        expect(range.tryMerge(new GeohashRange(10, 20))).to.equal(true);
        expect(range).to.deep.equal(new GeohashRange(10, 30));
    });

    it('does not merge a range beyond the merge threshold', function () {
        const range = new GeohashRange(10, 20);
        expect(range.tryMerge(new GeohashRange(23, 30))).to.equal(false);
        expect(range).to.deep.equal(new GeohashRange(10, 20));
    });

    it('does not merge overlapping ranges', function () {
        const range = new GeohashRange(10, 20);
        expect(range.tryMerge(new GeohashRange(15, 30))).to.equal(false);
        expect(range).to.deep.equal(new GeohashRange(10, 20));
    });
});
