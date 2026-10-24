import React, { useState, useEffect, useRef } from 'react';

export default function Header({ userName, onSearch, onLogout }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const dropdownRef = useRef(null);

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch(searchValue);
      setSearchValue('');
    }
  };

  const handleSearchClick = () => {
    onSearch(searchValue);
    setSearchValue('');
  };

  return (
    <header className="topbar">
      <table style={{ width: '100%' }}>
        <tbody>
          <tr>
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
            <th className="profileCol">
              <div
                className={`user-dropdown ${dropdownOpen ? 'active' : ''}`}
                ref={dropdownRef}
              >
                <div
                  className="gmailp"
                  id="accountDropdownBtn"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                >
                  <img className="logo" src="/Pictures/Gmail.png" alt="Profile" />
                  <b id="accountName">{userName || 'Guest'}</b>
                  <i className="fa-solid fa-chevron-down dropdown-arrow"></i>
                </div>
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
