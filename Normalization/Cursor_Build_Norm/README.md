# EntityMatch Pro: Data Wrangling Studio

A powerful Next.js application for cleaning, normalizing, and deduplicating CSV data with a focus on entity-related information such as company names, addresses, cities, and states.

## Features

### 🚀 Core Functionality

- **CSV File Upload**: Drag-and-drop or click to upload CSV files
- **Reference File Support**: Upload city/state reference data for validation
- **Real-time Column Detection**: Automatically identifies text, email, website, and address columns
- **Dark/Light Theme**: Beautiful UI with theme persistence

### 🔧 Data Processing

- **Text Processing**:
  - Uppercase conversion (smart exclusion of URLs/emails)
  - Whitespace normalization
  - Punctuation cleanup

- **Company Name Cleaning**:
  - Remove legal entity suffixes (LLC, Inc., Corp., etc.)
  - Replace custom abbreviations
  - Group companies by cleaned name

- **Address Parsing**:
  - Combine multiple address fields
  - Create Full_Address column

- **City & State Validation**:
  - Validate against reference data
  - Normalize state names to abbreviations
  - Flag invalid cities and city-state combinations

- **Email Processing**:
  - Clean and normalize email addresses
  - Extract email domains automatically

- **Website Cleaning**:
  - Remove protocols (http/https)
  - Strip www. prefix
  - Remove paths and query strings

- **Duplicate Detection**:
  - Configurable column-based duplicate removal
  - Track and report duplicates removed

### 📊 Results & Analytics

- **Processing Summary**: View detailed statistics on changes made
- **Column-by-Column Changes**: See exactly what changed in each column
- **Side-by-Side Comparison**: Compare original vs. processed data
- **Export to CSV**: Download cleaned data with original filename preserved

### ⚙️ Management Tools

- **Abbreviation Manager**:
  - Add custom company abbreviation rules
  - Edit and delete existing rules
  - Search and filter abbreviations
  - Persistent storage

- **Legal Entities Manager**:
  - Manage legal entity suffixes to remove
  - Add/remove entities easily
  - Pre-loaded with common entities

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **CSV Parsing**: PapaParse
- **Icons**: Lucide React
- **State Management**: React Hooks

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd entitymatch-pro
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Basic Workflow

1. **Upload CSV**: Drag and drop your CSV file or click to browse
2. **Configure Processing**: Enable desired features and select columns
3. **Manage Rules**: Add custom abbreviations and legal entities
4. **Start Processing**: Click "Start Processing" to clean your data
5. **Review Results**: View statistics and compare original vs. processed data
6. **Export**: Download the cleaned CSV file

### Reference File Format

For city/state validation, upload a CSV with these columns:
- `city`: City name
- `state`: State abbreviation (e.g., "CA", "NY")
- `City_State`: Combined format (e.g., "Los Angeles, CA")

## Project Structure

```
/app
  /page.tsx              # Main application page
  /layout.tsx            # Root layout
  /globals.css           # Global styles
/components
  /Sidebar.tsx           # Navigation and stats sidebar
  /FileUpload.tsx        # File upload component
  /ConfigurationPanel.tsx # Processing configuration
  /AbbreviationManager.tsx # Abbreviation CRUD
  /LegalEntitiesManager.tsx # Legal entities management
  /ResultsDisplay.tsx    # Results and comparison
  /ui/                   # Reusable UI components
/lib
  /storage.ts            # LocalStorage utilities
  /dataProcessing.ts     # Core processing engine
  /types.ts              # TypeScript interfaces
  /utils.ts              # Helper functions
```

## Configuration Options

### Text Processing
- Uppercase conversion (excludes URLs/emails)
- Normalization & cleanup (punctuation, whitespace)

### Address Parsing
- Select Address 1 and Address 2 columns
- Creates combined Full_Address column

### City & State Validation
- Requires reference file upload
- Validates city and state combinations
- Creates City_Valid and City_State_Valid columns

### Company Name Cleaning
- Select company name column
- Remove legal entities (LLC, Inc., etc.)
- Replace abbreviations with full names
- Group rows by cleaned company name

### Duplicate Detection
- Select columns for duplicate detection
- Removes exact matches
- Reports count of duplicates removed

## Data Privacy

All data processing happens entirely in your browser. No data is sent to any server. Files are processed locally using JavaScript.

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- IE: Not supported

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

