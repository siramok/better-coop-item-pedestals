// Entry point for the TypeScriptToLua bundler
import main from "./main";

// If the user does not have Repentance installed, don't proceed
if (REPENTANCE === true) {
  main();
}

// Do not add any code to this file
