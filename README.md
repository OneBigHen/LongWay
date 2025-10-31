Hackathon Submission
Problem: As a passionate adventure motorcyclist, I got tired of juggling five different apps just to plan a decent ride. Google Maps optimizes for highways. Strava and Komoot are great for bikes and hiking, but useless for motorcycles. My riding group shares GPX files through Facebook messages, and half the time we miss the good stops because nobody mentions them. There's 8.6M+ motorcyclists in the US dealing with this fragmented mess.

What I Built: Take the Long Way is a route planner that actually understands what makes a ride worth taking. It combines scenic route discovery with real-time POI recommendations based on what you're actually looking for—not generic tourist traps.

Stack: Next.js 15, TypeScript, Tailwind, Google Maps API, You.com Custom Agents.

How I'm Using You.com APIs:

Route Optimization Agent - Analyzes routes for curvature, elevation changes, and scenic byways. Basically finds the twisty mountain roads Google hides from you.

POI Discovery Agent - Takes your free-text input ("curvy roads + craft breweries + avoid highways") and surfaces relevant stops along your route. State parks, viewpoints, local diners, bike-friendly hotels.

Web Search API (planned) - Real-time road conditions, closures, weather alerts. Because nobody wants to hit a washed-out mountain pass.

Why It Matters: Instead of planning routes in three different apps and hoping your group sees the Facebook post about that awesome BBQ spot at mile 47, everything lives in one place. Import your buddy's GPX file, overlay it on yours, see where your routes intersect, and share waypoints that actually matter.

This isn't just for motorcyclists—RV travelers, road-trippers, photographers chasing golden hour—anyone who values the journey over the destination can use this.



Track 3 - Open Agentic Innovation: Multi-agent orchestration where each agent specializes vs dumping everything into one bloated prompt. Real context-aware recommendations, not hallucinated tourist guides.

Quick Start
bash
git clone <repo-url> && cd LongWay
npm install
Create .env.local with your API keys:

text
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
YOU_API_KEY=your_key
NEXT_PUBLIC_YOU_AGENT_ID=poi_agent_id
NEXT_PUBLIC_YOU_ROUTE_ID=route_agent_id
bash
npm run dev
Open http://localhost:3000 → Enter origin/destination → Pick "Scenic Route AI" → Add what you're looking for → Hit "Find My Route"