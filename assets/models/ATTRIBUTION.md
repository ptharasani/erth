# Anatomy model attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.

- Original dataset: [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), release 3.0 (20110915), polygon reduction 95%.
- Copy used: binary STL conversions of that release in [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D) at commit `f0eeb6e` (`assets/BodyParts3D_data/stl/`), which distributes the data under CC BY-SA 2.1 Japan.
- Retrieved: 2026-10-16. Every input file is pinned by SHA-256 in [manifest.json](manifest.json) and `scripts/model-inputs.json`.
- Model/data license: [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en). `skeleton.glb` is an adaptation and is shared under the same license.
- Original work: Mitsuhashi et al., “BodyParts3D: 3D structure database for anatomical concepts”, Nucleic Acids Research 37 (2009), D782–D785. [DOI](https://doi.org/10.1093/nar/gkn613).

Changes by OrganUI: selected 242 bone, cartilage and disc meshes, welded duplicate STL vertices, simplified each mesh with meshoptimizer (2.1 million to about 277,000 triangles), recentered and uniformly scaled coordinates, changed axes from Z-up to Y-up, recomputed smooth normals, assigned illustrative colors, and converted STL to GLB. No sculpting or invented anatomy.

The MIT license for original application code does not relicense this model or its derived screenshots. Preserve this attribution, the license link and the modification notice when redistributing the model or images of it. DBCLS does not endorse this demonstration. The source can contain missing or incorrect anatomical representations.
