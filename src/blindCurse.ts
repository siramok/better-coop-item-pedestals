// This sprite object is initialized once to allow reuse
const blindSprite = Sprite();
blindSprite.Load("gfx/005.100_collectible.anm2", true);
blindSprite.ReplaceSpritesheet(1, "gfx/items/collectibles/questionmark.png");
blindSprite.LoadGraphics();

// Returns true if the pedestal sprite is hidden, false otherwise
export function hasBlindSprite(entitySprite: Sprite): boolean {
  blindSprite.SetFrame(entitySprite.GetAnimation(), entitySprite.GetFrame());
  for (let i = -31; i < -13; i++) {
    const entityColor = entitySprite.GetTexel(Vector(0, i), Vector.Zero, 1);
    const blindColor = blindSprite.GetTexel(Vector(0, i), Vector.Zero, 1);
    if (
      entityColor.Red !== blindColor.Red ||
      entityColor.Green !== blindColor.Green ||
      entityColor.Blue !== blindColor.Blue
    ) {
      return false;
    }
  }
  return true;
}

// Returns true if the curse of the blind is active, false otherwise
export function isBlindCurseActive(): boolean {
  const game = Game();
  const level = game.GetLevel();
  const curses = level.GetCurses();
  return (curses & 64) === 0;
}
