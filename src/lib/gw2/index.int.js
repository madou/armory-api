const { default: gw2Api, ...gw2 } = require('proxyquire')('lib/gw2', {
  'lib/services/fetch': { setTokenValidity: (promise) => promise },
});

describe('gw2 api', function () {
  this.timeout(40000);

  const testToken = '938C506D-F838-F447-8B43-4EBF34706E0445B2B503-977D-452F-A97B-A65BB32D6F15';

  it('should return account data', () => {
    return gw2Api.readAccount(testToken)
      .then((account) => {
        expect(account.name).to.equal('stress level zero.4907');
      });
  });

  it('should return character data as expected', () => {
    return gw2Api.readCharacter(testToken, 'Blastrn')
    .then((character) => {
      expect(character.name).to.equal('Blastrn');
      expect(character.race).to.equal('Asura');
      expect(character.gender).to.equal('Female');
      expect(character.profession).to.equal('Elementalist');
      expect(character.level).to.equal(80);
      expect(character.age).to.exist;
      expect(character.created).to.equal('2015-06-23T10:53:00Z');
      expect(character.deaths).to.exist;
      expect(character.crafting).to.exist;
      expect(character.equipment).to.exist;
      expect(character.bags).to.exist;
    });
  });

  describe('test', () => {
    it('should return unique stuffs', async () => {
      const mdou = await gw2Api.readCharacter(testToken, 'Mdou');
      const blastrn = await gw2Api.readCharacter(testToken, 'Blastrn');

      expect(mdou).to.not.eql(blastrn);
    });
  });

  it('should return pvp stats', () => {
    return gw2Api.readPvpStats(testToken)
      .then((pvp) => {
        expect(pvp.pvp_rank).to.exist;
        expect(pvp.pvp_rank_points).to.exist;
        expect(pvp.pvp_rank_rollovers).to.exist;
        expect(pvp.aggregate).to.exist;
        expect(pvp.professions).to.exist;
        expect(pvp.ladders).to.exist;
      });
  });

  it('should return invalid token error', async () => {
    return expect(gw2Api.readCharacter('invalid', 'Blastrn'))
      .to.be.rejectedWith('Request failed with status code 403');
  });

  it('should return characters data as expected', () => {
    return gw2Api.readCharacters(testToken)
      .then((data) => {
        expect(Array.isArray(data)).to.equal(true);
      });
  });

  it('should read latest pvp season', async () => {
    const season = await gw2.readLatestPvpSeason();

    expect(season).to.exist;
  });

  it('should read all 250 standings', async () => {
    const standings = await gw2Api.readPvpLadder(null, 'A54849B7-7DBD-4958-91EF-72E18CD659BA', {
      region: 'na',
    });

    expect(standings.length).to.equal(250);
  });
});
