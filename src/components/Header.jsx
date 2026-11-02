// Import React hooks:
// - useState: for local search input and dropdown open/close state
// - useEffect: to attach document click listener for closing the dropdown when clicking outside
// - useRef: references the dropdown DOM element to detect outside clicks
import React, { useState, useEffect, useRef } from 'react';

/**
 * Header Component
 * Displays the top navigation bar containing:
 * - Search bar with input and search button
 * - User profile info and logout dropdown
 * 
 * Props:
 * - userName: string, the currently logged-in user's display name
 * - onSearch: function, callback invoked when user presses Enter or clicks the search icon
 * - onLogout: function, callback invoked when user clicks "Log out"
 */
export default function Header({ userName, onSearch, onLogout }) {
  const [dropdownOpen, setDropdownOpen] = useState(false); // Controls whether the profile dropdown menu is open
  const [searchValue, setSearchValue] = useState('');      // Controlled input state for the search query
  const dropdownRef = useRef(null);                        // DOM reference to the user dropdown wrapper

  // Close the profile dropdown menu if the user clicks anywhere outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Trigger search when user presses Enter in the input box
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch(searchValue);
      setSearchValue('');
    }
  };

  // Trigger search when user clicks the magnifying glass button
  const handleSearchClick = () => {
    onSearch(searchValue);
    setSearchValue('');
  };

  return (
    <header className="topbar">
      <table style={{ width: '100%' }}>
        <tbody>
          <tr>
            {/* Left column: Search bar */}
            <th className="searchCol">
              <div className="searchbar">
                <button
                  id="searchId"
                  className="searchButton"
                  type="button"
                  onClick={handleSearchClick}
                >
                  <img className="logo" src="/Pictures/Find.png" alt="Search" />
                </button>
                <input
                  id="searchTextId"
                  className="searchBox"
                  type="search"
                  placeholder="Search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </th>

            {/* Right column: User profile & logout dropdown */}
            <th className="profileCol">
              <div
                className={`user-dropdown ${dropdownOpen ? 'active' : ''}`}
                ref={dropdownRef}
              >
                {/* Profile pill button that toggles the dropdown */}
                <div
                  className="gmailp"
                  id="accountDropdownBtn"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                >
                  <img className="logo" src="/Pictures/Gmail.png" alt="Profile" />
                  <b id="accountName">{userName || 'Guest'}</b>
                  <i className="fa-solid fa-chevron-down dropdown-arrow"></i>
                </div>

                {/* Dropdown menu */}
                <div className="dropdown-menu" id="accountDropdownMenu">
                  <button
                    id="logoutBtn"
                    className="dropdown-item"
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                  >
                    <i className="fa-solid fa-right-from-bracket"></i> Log out
                  </button>
                </div>
              </div>
            </th>
          </tr>
        </tbody>
      </table>
    </header>
  );
}
