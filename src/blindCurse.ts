// This sprite object is initialized once to allow reuse
const blindSprite = Sprite();
blindSprite.Load("gfx/005.100_collectible.anm2", true);
blindSprite.ReplaceSpritesheet(1, "gfx/items/collectibles/questionmark.png");
blindSprite.LoadGraphics();

// Returns true if the pedestal sprite is hidden, false otherwise
export function isBlindCurseSprite(sprite: Sprite): boolean {
  const animation = sprite.GetAnimation();
  if (animation !== CollectibleAnimation.IDLE) {
    return false;
  }
  const frame = sprite.GetFrame();
  blindSprite.SetFrame(animation, frame);
  for (let i = -3; i < 3; i += 2) {
    for (let j = -31; j < -13; j += 2) {
      const spriteColor = sprite.GetTexel(Vector(i, j), Vector.Zero, 1);
      const blindColor = blindSprite.GetTexel(Vector(i, j), Vector.Zero, 1);
      if (
        spriteColor.Red !== blindColor.Red ||
        spriteColor.Green !== blindColor.Green ||
        spriteColor.Blue !== blindColor.Blue
      ) {
        return false;
      }
    }
  }
  return true;
}

// Returns true if the curse of the blind is active, false otherwise
export function isBlindCurseActive(): boolean {
  const game = Game();
  const level = game.GetLevel();
  const curses = level.GetCurses();
  return (curses & 64) !== 0;
}
