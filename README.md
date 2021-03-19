# Champlain Ice

A Google Earth Engine App to explore lake ice extent on Lake Champlain using Sentinel-1 SAR data.

The app can be found [here](https://astone.users.earthengine.app/view/champlain-ice)

### Layers
Ice-On: The earliest winter date with ice coverage for each pixel, computed by finding the largest difference in backscatter values in a time series ranging from November to February.

Ice-Off: The earliest spring date with open water for each pixel, computed using the same difference measure.

Current Conditions: Estimated current ice cover on Lake Champlain, based on the most recent available SAR image. Ice extent is computed via Otsu thresholding.


#### References

Y. Zhang, G. Zhang, and T. Zhu, “Seasonal cycles of lakes on the Tibetan Plateau detected by Sentinel-1 SAR data,” Science of the Total Environment, vol. 703,  2020, doi:10.1016/j.scitotenv.2019.135563.

J. Murfitt and C. R. Duguay, “Assessing the performance of methods for monitoring ice phenology of theworld’s largest high arctic lake using high-density time series analysis of Sentinel-1 data,” Remote Sensing, vol. 12, no. 3, pp. 1–24, 2020, doi: 10.3390/rs12030382.
