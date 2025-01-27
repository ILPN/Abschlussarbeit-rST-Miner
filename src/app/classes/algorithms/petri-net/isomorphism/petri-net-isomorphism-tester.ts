import { MapSet } from '../../../utility/map-set';
import { MappingManager } from './classes/mapping-manager';
import { PetriNet } from '../../../models/petri-net/petri-net';
import { Transition } from '../../../models/petri-net/transition';
import { PetriNetToPartialOrderTransformer } from '../../transformation/petri-net-to-partial-order-transformer';
import { PartialOrderIsomorphismTester } from '../../partial-order/isomorphism/partial-order-isomorphism-tester';

export class PetriNetIsomorphismTester {
    constructor(
        protected _pnToPoTransformer: PetriNetToPartialOrderTransformer,
        protected _poIsomorphism: PartialOrderIsomorphismTester
    ) {}

    public arePartialOrderPetriNetsIsomorphic(
        partialOrderA: PetriNet,
        partialOrderB: PetriNet
    ): boolean {
        if (
            !PetriNetIsomorphismTester.compareBasicNetProperties(
                partialOrderA,
                partialOrderB
            )
        ) {
            return false;
        }

        return this._poIsomorphism.arePartialOrdersIsomorphic(
            this._pnToPoTransformer.transform(partialOrderA),
            this._pnToPoTransformer.transform(partialOrderB)
        );
    }

    public arePetriNetsIsomorphic(netA: PetriNet, netB: PetriNet): boolean {
        if (!PetriNetIsomorphismTester.compareBasicNetProperties(netA, netB)) {
            return false;
        }

        const transitionMapping =
            PetriNetIsomorphismTester.determinePossibleTransitionMappings(
                netA,
                netB
            );
        if (transitionMapping === undefined) {
            return false;
        }

        const placeMapping =
            PetriNetIsomorphismTester.determinePossiblePlaceMappings(
                netA,
                netB
            );
        if (placeMapping === undefined) {
            return false;
        }

        const transitionMappingManager = new MappingManager(transitionMapping);
        const placeMappingManager = new MappingManager(placeMapping);

        let done = false;
        do {
            const transitionMapping =
                transitionMappingManager.getCurrentMapping();
            const uniqueTransitionsMapped = new Set<string>(
                transitionMapping.values()
            );
            if (transitionMapping.size === uniqueTransitionsMapped.size) {
                // bijective transition mapping
                const placeMapping = placeMappingManager.getCurrentMapping();
                const uniquePlacesMapped = new Set<string>(
                    placeMapping.values()
                );
                if (
                    placeMapping.size === uniquePlacesMapped.size && // bijective place mapping
                    this.isMappingAPetriNetIsomorphism(
                        netA,
                        netB,
                        transitionMapping,
                        placeMapping
                    )
                ) {
                    return true;
                }
            }

            const carry = transitionMappingManager.moveToNextMapping();
            if (carry) {
                done = placeMappingManager.moveToNextMapping();
            }
        } while (!done);

        return false;
    }

    private static compareBasicNetProperties(
        netA: PetriNet,
        netB: PetriNet
    ): boolean {
        return (
            netA.getTransitionCount() === netB.getTransitionCount() &&
            netA.getPlaceCount() === netB.getPlaceCount() &&
            netA.getArcCount() === netB.getArcCount() &&
            netA.inputPlaces.size === netB.inputPlaces.size &&
            netA.outputPlaces.size === netB.outputPlaces.size
        );
    }

    private static determinePossibleTransitionMappings(
        netA: PetriNet,
        netB: PetriNet
    ): MapSet<string, string> | undefined {
        const transitionMapping = new MapSet<string, string>();
        for (const tA of netA.getTransitions()) {
            let wasMapped = false;
            for (const tB of netB.getTransitions()) {
                if (
                    tA.label === tB.label &&
                    tA.ingoingArcs.length === tB.ingoingArcs.length &&
                    tA.outgoingArcs.length === tB.outgoingArcs.length
                ) {
                    wasMapped = true;
                    transitionMapping.add(tA.getId(), tB.getId());
                }
            }
            if (!wasMapped) {
                return undefined;
            }
        }
        return transitionMapping;
    }

    private static determinePossiblePlaceMappings(
        netA: PetriNet,
        netB: PetriNet
    ): MapSet<string, string> | undefined {
        const placeMapping = new MapSet<string, string>();
        for (const pA of netA.getPlaces()) {
            let wasMapped = false;
            for (const pB of netB.getPlaces()) {
                if (
                    pA.marking === pB.marking &&
                    pA.ingoingArcs.length === pB.ingoingArcs.length &&
                    pA.outgoingArcs.length === pB.outgoingArcs.length
                ) {
                    wasMapped = true;
                    placeMapping.add(pA.getId(), pB.getId());
                }
            }
            if (!wasMapped) {
                return undefined;
            }
        }
        return placeMapping;
    }

    private isMappingAPartialOrderIsomorphism(
        partialOrderA: PetriNet,
        partialOrderB: PetriNet,
        transitionMapping: Map<string, string>
    ): boolean {
        const unmappedArcs = partialOrderB
            .getPlaces()
            .filter(
                p => p.ingoingArcs.length !== 0 && p.outgoingArcs.length !== 0
            );

        for (const arc of partialOrderA.getPlaces()) {
            if (arc.ingoingArcs.length === 0 || arc.outgoingArcs.length === 0) {
                continue;
            }
            const preTransitionB = transitionMapping.get(
                arc.ingoingArcs[0].sourceId
            )!;
            const postTransitionB = transitionMapping.get(
                arc.outgoingArcs[0].destinationId
            );

            const fittingArcIndex = unmappedArcs.findIndex(
                unmapped =>
                    unmapped.ingoingArcs[0].sourceId === preTransitionB &&
                    unmapped.outgoingArcs[0].destinationId === postTransitionB
            );
            if (fittingArcIndex === -1) {
                return false;
            }
            unmappedArcs.splice(fittingArcIndex, 1);
        }

        return true;
    }

    private isMappingAPetriNetIsomorphism(
        netA: PetriNet,
        netB: PetriNet,
        transitionMapping: Map<string, string>,
        placeMapping: Map<string, string>
    ): boolean {
        const unmappedArcs = netB.getArcs();

        for (const arc of netA.getArcs()) {
            let arcSourceId: string;
            let arcDestinationId: string;
            if (arc.source instanceof Transition) {
                arcSourceId = transitionMapping.get(arc.sourceId)!;
                arcDestinationId = placeMapping.get(arc.destinationId)!;
            } else {
                arcSourceId = placeMapping.get(arc.sourceId)!;
                arcDestinationId = transitionMapping.get(arc.destinationId)!;
            }

            // TODO arc weight is not considered when creating possible mappings. Inclusion of this property might make the algorithm more efficient
            const fittingArcIndex = unmappedArcs.findIndex(
                unmapped =>
                    unmapped.sourceId === arcSourceId &&
                    unmapped.destinationId === arcDestinationId &&
                    unmapped.weight === arc.weight
            );
            if (fittingArcIndex === -1) {
                return false;
            }
            unmappedArcs.splice(fittingArcIndex, 1);
        }

        return true;
    }
}
