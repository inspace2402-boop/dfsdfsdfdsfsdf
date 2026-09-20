const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const strToFind = `                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: LOCATIONS IMPORT & RENDERING SYSTEM */}`;

const newStr = `                    </div>
                  )}
                </div>
              </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: LOCATIONS IMPORT & RENDERING SYSTEM */}`;

if (content.includes(strToFind)) {
    content = content.replace(strToFind, newStr);
    fs.writeFileSync('src/components/Sidebar.tsx', content);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find strToFind.");
    const endStr = 'Tab 3: LOCATIONS IMPORT';
    const idx = content.indexOf(endStr);
    console.log(content.substring(idx - 200, idx + 50));
}
