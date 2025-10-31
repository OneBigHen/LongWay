# Project Overview

This is a Next.js web application called "Take the Long Way" that helps users plan scenic road trips. It functions as an Airbnb-style road trip planner, allowing users to input an origin and destination, and then discover interesting points of interest (POIs) and alternative routes along the way.

The application is built with the following technologies:

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Mapping:** Google Maps API
*   **AI-powered features:** You.com Agent API for suggesting POIs and alternative routes.
*   **Testing:** Playwright for end-to-end testing.

## Key Features

*   **Route Planning:** Users can plan a route by providing an origin and destination.
*   **POI Suggestions:** The application suggests points of interest along the route, such as scenic roads, state parks, breweries, and restaurants. These suggestions are powered by an AI agent from You.com.
*   **Alternative Routes:** The application can suggest alternative, more scenic routes, also powered by a You.com AI agent.
*   **GPX and KML Support:** Users can import and export routes in GPX format, and overlay KML files on the map.
*   **Interactive Map:** The application features an interactive map that displays the route, POIs, and other information.

# Building and Running

The following scripts are available in `package.json`:

*   `npm run dev`: Starts the development server.
*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Lints the codebase using Next.js's built-in ESLint configuration.
*   `npm run test`: Runs end-to-end tests using Playwright.

## Running the application

1.  Install dependencies: `npm install`
2.  Set up environment variables. You will need API keys for the Google Maps API and the You.com API. Create a `.env.local` file in the root of the project and add the following variables:

    ```
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
    YOU_API_KEY=your_you_com_api_key
    YOU_AGENT_ID=your_you_com_agent_id
    YOU_ROUTE_ALT_AGENT_ID=your_you_com_route_alt_agent_id
    ```

3.  Run the development server: `npm run dev`
4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

# Development Conventions

*   **Component-based architecture:** The frontend is built with React components, located in the `components` directory.
*   **API Routes:** Backend functionality is implemented using Next.js API routes, located in the `app/api` directory.
*   **Styling:** Tailwind CSS is used for styling. Utility classes are used directly in the components.
*   **Types:** TypeScript is used for static typing. Type definitions are located in the `lib/types.ts` file.
*   **Linting:** The project uses ESLint to enforce code quality. Run `npm run lint` to check for linting errors.
*   **Testing:** End-to-end tests are written with Playwright and are located in the `tests` directory (not present in the initial file listing, but inferred from `playwright.config.ts` and `package.json`).
