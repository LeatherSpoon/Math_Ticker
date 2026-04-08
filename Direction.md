I want a web based 3D game which is orthographic perspective without an isometric angle. I want clean confident outlines, Ensure the generated meshes have distinct readable silhouettes suitable for a top down game. The game uses westernized anime style inspired by Avatar: The Last Airbender and Studio Ghibli. The script can modularly generate the base meshes. I like painterly. The game has a sci-fi theme but is terrestrial and no spaceships (other than the one that brought the player character (PC) to the first world) are present. Kitbashing is permitted.  



I want to incorporate idle rpg numbers going up and loops that feed it; and adopt an active component to it which involves moving the main character to complete tasks that also boost that main number. There is combat, so that means I need NPC's that do combat.



## **Combat:**

This is handled like a pokemon combat window that cuts away from the overworld with the top of the frame consisting of a window that contains an image of the PC's back facing the player and the opponent facing the player across from the PC. On the bottom of the frame a user interface is present with options: Fight, Items, Run, Skills.

Under the PC and above the opponent are their respective health bars

About the PC is a loop that fills each tick starting at the 6 o'clock position rotating clockwise. that is to be used to allocate points for actions. These are "Focus Points" (FP). Combat is initiated when PC approaches an aggro NPC. 



##### Fight:

Fight is a spammable attack damaging 1\*Strength

##### Items:

See below

##### Run:

Provides a chance to escape from combat that is based on the PC's Agility in relation to the opponents.

##### Skills:

Jab (20 FP) - Attacks opponent for 2\*Strength

Heavy Hit (100 FP) - Attacks opponent for 4\*Strength

Kinetic Driver (200 FP) - Attacks opponent for 5\*Strength

Ballistic Lunge (300 FP) - Attacks opponent for 6\*Strength

Ion Beam (500 FP) - Attacks opponent for 7\*Strength

Scan (100 FP) - Inspects opponent



Combat styles:
Melee, Armed, Ranged (projectile based), Energy
---





### Character Stats:

|Stat|Description|Primary Role|
|-|-|-|
|Strength|Raw physical power - melee force, breaking obstacles, carrying capacity.|Melee damage output, obstacle interaction|
|Health|Total HP ceiling.|Total damage absorption before defeat.|
|Defense|Incoming damage modifier. Reduces effective damage of each hit received.|Damage mitigation in combat.|
|Constitution|Recovery speed and debuff resistance - how fast you shake off negative status effects|Healing rate, debuff duration reduction.|
|Dexterity|Fine motor control governing ranged attack accuracy and damage, plus precision in crafting and gathering.|Ranged combat (accuracy + damage), crafting quality, gathering yield|
|Agility|Combat initiative and evasion — who strikes first and chance to dodge incoming attacks.|Strike order, dodge chance|
|Perception|Environmental awareness — spotting hidden nodes, reading terrain, anticipating combat moves.|Gathering node visibility, combat anticipation, map awareness|
|Focus rate|Increases the rate of focus|Accelerates accrual of FP|
|Focus|Total Focus|Is the maximum FP|
|Crafting|Unlocks new items|The higher the level the more items that are able to be crafted|
|Crafting Speed|Reduces time per item|Crafting time requirement is reduced|
|Speed|||







The cyborg's equipment screen (Loadout tab) has nine defined slots. Six are active gear slots that provide stat bonuses and combat function can also be tools. Two are pre-combat assignment slots. All items are equip-and-forget except consumables (final slot) and deployables, which are consumed on use.

All equipment — weapons and augments — exists across four quality tiers:
Basic, Good, Rare, Epic



### Items:

Crafting Materials:

copper, timber, stone, iron, carbon, quartz, silica, fiber, silver, gold, titanium, tungsten, resin, epoxy, elastomer, magnet, glass



Consumables:
ration (20 HP), first aid (60 HP), repair kit (100 HP), antidote (cures poison)





#### Number (Processing Power (PP)):

This is the player's experience points. The player spends these on increasing the Character Stats and accelerating the number growth itself. It also is the gate that unlocks new environments. PP initially grows at 1/sec.



#### Environments:

Landing Site - Rich in resources. Settlement is situated in a grassy meadow that has a thick forest perimeter with a mountain just beyond the forest. Unlocked immediately.



Mine - This is inside the mountain that is adjacent to the forest near the Landing Site. It holds resources that a mine would. It also is the primary point where all the portals can be found after they are unlocked. Mine is unlocked immediately, but navigation is impeded by the forest that the player must manipulate.



Verdant Maw - Dense jungle. Unlocked after 1000PP



Lagoon Coast - Beach / island archipelago. Unlocked after 9000PP



Frozen Tundra - 



##### Drones:

This is the idle aspect and assistant to gather materials they are assigned to. Rescue drone also 'flies' to PC location and takes PC back to Landing Site if HP gets to 1. Drones can be upgraded with PP. Drones take time to gather resources and by default they are inefficient. Better resources require more time which makes the player need to further upgrade the drones.





##### Status Effects:

Burn - damage over time

Shock - slows FP gain

Corrosion - reduces defense

Poison - damage over time





#### Pedometer:

###### Movement is rewarded

The PC step count is tracked. The steps also contribute to PP. The amount that it contributes is upgraded linearly and purchased with steps. The requirement for the upgrade increases significantly each time. What else can be purchased with step count is: tracks that make the player move faster (these can be stacked), Character Stat levels, select environment unlock.





Terrain:
Some terrains are harder to traverse and will require a higher speed level to feel normal.
Some tiles cost HP to cross. 






Enemies:
Scrapper - melee, attacks every 2 seconds for 4HP



##### Offload:

Player voluntarily trades all of their PP growth for EXP to be used to level up player stats.



Movement: 

8 degrees of freedom. 
















