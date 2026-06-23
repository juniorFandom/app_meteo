        (function() {
            "use strict";

            // ---------- Configuration ----------
            const API_KEY = 'bd5e378503939ddaee76f12ad7a97608'; // clé publique OpenWeatherMap 
            const BASE_URL = 'https://api.openweathermap.org/data/2.5/';

            // Éléments DOM
            const cityInput = document.getElementById('cityInput');
            const searchBtn = document.getElementById('searchBtn');
            // const messageEl = document.getElementById('message');

            const cityNameEl = document.getElementById('cityName');
            const currentDateEl = document.getElementById('currentDate');
            const humidityEl = document.getElementById('humidity');
            const windSpeedEl = document.getElementById('windSpeed');
            const weatherIconEl = document.getElementById('weatherIcon');
            const currentTempEl = document.getElementById('currentTemp');
            const weatherDescEl = document.getElementById('weatherDesc');
            const forecastContainer = document.getElementById('forecastContainer');

            // ---------- Helpers ----------
            function formatDate(timestamp) {
                const d = new Date(timestamp * 1000);
                return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            }

            function formatTime(timestamp) {
                return new Date(timestamp * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            }

            // Obtenir l'icône FontAwesome en fonction du code OpenWeatherMap
            function getWeatherIcon(iconCode) {
                const iconMap = {
                    '01d': 'fa-sun', '01n': 'fa-moon',
                    '02d': 'fa-cloud-sun', '02n': 'fa-cloud-moon',
                    '03d': 'fa-cloud', '03n': 'fa-cloud',
                    '04d': 'fa-cloud', '04n': 'fa-cloud',
                    '09d': 'fa-cloud-rain', '09n': 'fa-cloud-rain',
                    '10d': 'fa-cloud-sun-rain', '10n': 'fa-cloud-moon-rain',
                    '11d': 'fa-bolt', '11n': 'fa-bolt',
                    '13d': 'fa-snowflake', '13n': 'fa-snowflake',
                    '50d': 'fa-smog', '50n': 'fa-smog'
                };
                return iconMap[iconCode] || 'fa-cloud';
            }

            // Convertir Kelvin en °C
            function kelvinToCelsius(k) {
                return Math.round(k - 273.15);
            }

            // ---------- Récupération API ----------
            async function fetchWeatherData(city) {
                if (!city || city.trim() === '') {
                    setMessage('Veuillez entrer une ville.', true);
                    return null;
                }
                // const trimmed = city.trim();
                // setMessage('Recherche en cours...', false);

                try {
                    // 1) Appel météo actuelle
                    const weatherRes = await fetch(
                        `${BASE_URL}weather?q=${encodeURIComponent(trimmed)}&appid=${API_KEY}`
                    );
                    if (!weatherRes.ok) {
                        if (weatherRes.status === 404) {
                            setMessage(`Ville "${trimmed}" introuvable. Vérifiez l'orthographe.`, true);
                        } else {
                            setMessage(`Erreur API (${weatherRes.status}). Réessayez.`, true);
                        }
                        return null;
                    }
                    const weatherData = await weatherRes.json();

                    // 2) Appel prévisions 5 jours
                    const forecastRes = await fetch(
                        `${BASE_URL}forecast?q=${encodeURIComponent(trimmed)}&appid=${API_KEY}`
                    );
                    if (!forecastRes.ok) {
                        setMessage('Impossible de récupérer les prévisions.', true);
                        return null;
                    }
                    const forecastData = await forecastRes.json();

                    return { current: weatherData, forecast: forecastData };
                } catch (error) {
                    console.error('Fetch error:', error);
                    setMessage('Erreur réseau. Vérifiez votre connexion.', true);
                    return null;
                }
            }

            // ---------- Affichage ----------
            function displayWeather(data) {
                if (!data) return;

                const { current, forecast } = data;

                // --- Current ---
                const city = current.name;
                const country = current.sys?.country || '';
                cityNameEl.textContent = country ? `${city}, ${country}` : city;
                currentDateEl.textContent = new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                });

                const tempC = kelvinToCelsius(current.main.temp);
                currentTempEl.textContent = `${tempC}°C`;
                weatherDescEl.textContent = current.weather[0].description;

                const iconCode = current.weather[0].icon;
                weatherIconEl.className = `fas ${getWeatherIcon(iconCode)} weather-icon-big`;

                humidityEl.textContent = current.main.humidity;
                // conversion m/s → km/h
                const windKmh = (current.wind.speed * 3.6).toFixed(0);
                windSpeedEl.textContent = windKmh;

                // --- Forecast 5 jours (API retourne 40 intervalles de 3h, on prend une prévision par jour à midi) ---
                // Filtrer pour obtenir un point par jour (environ 12h)
                const forecastList = forecast.list;
                const dailyMap = new Map();

                forecastList.forEach(item => {
                    const date = new Date(item.dt * 1000);
                    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                    // On essaie de prendre la prévision la plus proche de midi (12h) pour chaque jour
                    const hour = date.getHours();
                    if (!dailyMap.has(dayKey) || Math.abs(hour - 12) < Math.abs(dailyMap.get(dayKey).hour - 12)) {
                        dailyMap.set(dayKey, { ...item, hour: hour });
                    }
                });

                // On garde les 5 prochains jours (en ignorant aujourd'hui si déjà passé)
                const today = new Date().toISOString().split('T')[0];
                const sortedDays = Array.from(dailyMap.keys()).sort();
                let nextDays = sortedDays.filter(day => day >= today);
                // Si on a plus de 5 jours, on prend les 5 premiers (mais on veut 5 jours de prévision)
                // On s'assure d'avoir au moins 5 jours (sinon on prend tous)
                if (nextDays.length < 5) {
                    // si la météo ne donne pas 5 jours, on utilise tous les jours disponibles
                    nextDays = sortedDays;
                } else {
                    nextDays = nextDays.slice(0, 5);
                }

                // Construction des cartes
                let forecastHtml = '';
                nextDays.forEach((dayKey) => {
                    const item = dailyMap.get(dayKey);
                    if (!item) return;
                    const dayName = new Date(item.dt * 1000).toLocaleDateString('fr-FR', { weekday: 'short' });
                    const tempMax = kelvinToCelsius(item.main.temp_max);
                    const tempMin = kelvinToCelsius(item.main.temp_min);
                    const desc = item.weather[0].description;
                    const icon = getWeatherIcon(item.weather[0].icon);

                    forecastHtml += `
                        <div class="forecast-card">
                            <div class="forecast-day">${dayName} ${formatDate(item.dt)}</div>
                            <i class="fas ${icon} forecast-icon"></i>
                            <div class="forecast-temp">${tempMax}°</div>
                            <div class="forecast-temp-min">${tempMin}°</div>
                            <div class="forecast-desc">${desc}</div>
                        </div>
                    `;
                });

                forecastContainer.innerHTML = forecastHtml || '<p style="color:white;grid-column:1/-1;text-align:center;">Aucune prévision disponible.</p>';

                // Message de succès
                setMessage(`Météo mise à jour pour ${city}`, false);
            }

            // ---------- Action principale ----------
            async function handleSearch() {
                const city = cityInput.value.trim();
                if (!city) {
                    setMessage('Veuillez saisir un nom de ville.', true);
                    return;
                }
                const data = await fetchWeatherData(city);
                if (data) {
                    displayWeather(data);
                }
                // Si erreur, fetchWeatherData a déjà rempli message
            }

            // ---------- Événements ----------
            searchBtn.addEventListener('click', handleSearch);
            cityInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                }
            });

            // ---------- Chargement initial (Paris) ----------
            window.addEventListener('DOMContentLoaded', async () => {
                const defaultCity = 'Paris';
                cityInput.value = defaultCity;
                const data = await fetchWeatherData(defaultCity);
                if (data) displayWeather(data);
            });

        })();
  