#!/usr/bin/env ruby
require 'xml'
require './strsim'

class TUILookup
  def initialize (semanticTypesFILE)
    # if semanticTypesFILE.nil?
      # puts "Null semantic types file name!"
    # else 
      # puts "Semantic types file name: " + semanticTypesFILE
    end
    parser = XML::Parser.file(semanticTypesFILE)
    doc = parser.parse

    dictionary = []

    beans = doc.find('/success/data/list/semanticTypeBean')
    beans.each do |b|
      tui         = b.find_first('./semanticType').content.strip
      description = b.find_first('./description').content.strip.downcase
      dictionary.push([description, tui])
    end

    # ad-hoc, needs to improve it
    dictionary.push(["gene","T028"])
    dictionary.push(["genome","T028"])
    dictionary.push(["disease","T047"])
    dictionary.push(["syndrome","T047"])
    dictionary.push(["sign","T184"])
    dictionary.push(["symptom","T184"])
    dictionary.push(["injury","T037"])
    dictionary.push(["poisoning","T037"])
    dictionary.push(["body location","T029"])
    dictionary.push(["body region","T029"])
    dictionary.push(["body part","T023"])
    dictionary.push(["organ","T023"])
    dictionary.push(["organ component","T023"])
    dictionary.push(["patient","T101"])
    dictionary.push(["disabled group","T101"])
    dictionary.push(["therapeutic procedure","T061"])
    dictionary.push(["preventive procedure","T061"])
    dictionary.push(["procedure","T060"])
    dictionary.push(["procedure","T061"])
    dictionary.push(["procedure","T059"])
    dictionary.push(["amino acid","T116"])
    dictionary.push(["peptide","T116"])
    dictionary.push(["protein","T116"])
    dictionary.push(["indicator","T130"])
    dictionary.push(["reagent","T130"])
    dictionary.push(["disgnostic aid","T130"])
    dictionary.push(["hazardous substance","T131"])
    dictionary.push(["poisonous substance","T131"])
    dictionary.push(["nucleic acid","T114"])
    dictionary.push(["nucleoside","T114"])
    dictionary.push(["nucleotide","T114"])
    dictionary.push(["neuroreactive substance","T124"])
    dictionary.push(["biogenic anime","T124"])
    dictionary.push(["organ function","T042"])
    dictionary.push(["tissue function","T042"])
    dictionary.push(["body space","T030"])
    dictionary.push(["junction","T030"])


    @dictionary = dictionary
  end

  def get_dictionary
    @dictionary
  end

  def lookup(keyword)
    return nil unless keyword
    results = []
    @dictionary.each do |key, tui|
      if (Strsim.jaccard(keyword, key) > 0.35)
        results.push(tui)
      end
    end
    results.uniq
  end
end

if __FILE__ == $0
  dic = TuiLookup.new("semanticTypes.xml")

  ARGF.each do |keyword|
    tuis = dic.lookup(keyword.chomp)
    p tuis
  end
end
