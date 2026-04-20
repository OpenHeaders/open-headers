// Post-response — assert the login returned a token.
pm.test('returns a session token', () => {
  pm.expect(pm.response.code).to.equal(200);
  pm.expect(pm.response.json().token).to.be.a('string');
});
