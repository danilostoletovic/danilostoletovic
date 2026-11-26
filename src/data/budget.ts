// Planning examples adapted from the former DanDelivers planner.
export const budgetPlanner = {
  "minimum": 150,
  "maximum": 2500,
  "step": 50,
  "scopes": [
    {
      "name": "Website",
      "examples": [
        {
          "budget": 150,
          "scope": "A simple one-page website using your content, with a clear way to get in touch."
        },
        {
          "budget": 250,
          "scope": "A one-page website with more sections and a contact form, using your content."
        },
        {
          "budget": 500,
          "scope": "A clear landing page with a contact form that works well on a phone."
        },
        {
          "budget": 1000,
          "scope": "A few pages, a booking or contact form, and a layout that looks good on every screen."
        },
        {
          "budget": 1800,
          "scope": "A bigger website with several pages and a few custom touches."
        }
      ]
    },
    {
      "name": "Mobile app",
      "examples": [
        {
          "budget": 150,
          "scope": "A simple single-purpose app with one screen and one core function."
        },
        {
          "budget": 250,
          "scope": "A single-purpose app with a few connected screens and basic local data storage."
        },
        {
          "budget": 500,
          "scope": "A small app with a more detailed workflow, input checks and saved data."
        },
        {
          "budget": 1000,
          "scope": "A simple app with a few screens, or the first rough version of a bigger one."
        },
        {
          "budget": 1800,
          "scope": "The first working version of one core idea for Android or the web."
        }
      ]
    },
    {
      "name": "Web app & AI",
      "examples": [
        {
          "budget": 150,
          "scope": "Review one small web workflow or AI feature and scope a useful first step."
        },
        {
          "budget": 250,
          "scope": "A small browser-based tool with one defined task and a simple interface."
        },
        {
          "budget": 500,
          "scope": "A small web workflow with input checks and saved data."
        },
        {
          "budget": 1000,
          "scope": "A first web app release with a few connected screens and a defined workflow."
        },
        {
          "budget": 1800,
          "scope": "A working first slice of a custom web app or a scoped AI feature connected to an existing workflow."
        }
      ]
    },
    {
      "name": "Backend & API",
      "examples": [
        {
          "budget": 150,
          "scope": "Review one API endpoint or diagnose a specific backend issue."
        },
        {
          "budget": 250,
          "scope": "One narrowly scoped API connection with input validation."
        },
        {
          "budget": 500,
          "scope": "A small API for a defined data workflow, with validation and documentation."
        },
        {
          "budget": 1000,
          "scope": "A backend for a small application, with data storage and agreed access controls."
        },
        {
          "budget": 1800,
          "scope": "A first backend release connecting the core workflow, data and authorised outside services."
        }
      ]
    },
    {
      "name": "Deployment",
      "examples": [
        {
          "budget": 150,
          "scope": "Review the deployment setup or fix one defined configuration issue."
        },
        {
          "budget": 250,
          "scope": "Deploy a small existing application to suitable hosting, with configuration agreed first."
        },
        {
          "budget": 500,
          "scope": "Configure a release for an existing app, including its domain and environment settings."
        },
        {
          "budget": 1000,
          "scope": "A repeatable deployment workflow with release checks and operational handover."
        },
        {
          "budget": 1800,
          "scope": "Deployment planning and setup for multiple application components, scoped to the existing infrastructure."
        }
      ]
    },
    {
      "name": "Integration",
      "examples": [
        {
          "budget": 150,
          "scope": "Check why one connection is failing, like a form that doesn't send or an embed that doesn't load."
        },
        {
          "budget": 250,
          "scope": "Wire one thing into your site: a contact form to your inbox, a booking link or another agreed service."
        },
        {
          "budget": 500,
          "scope": "Connect one outside service to your site, like a payment link, a newsletter or a calendar."
        },
        {
          "budget": 1000,
          "scope": "Two or three connections working together, like forms, email and a spreadsheet or CRM."
        },
        {
          "budget": 1800,
          "scope": "A simple API or AI feature added to your existing site or tool, with sensible limits."
        }
      ]
    }
  ]
} as const;
